"""Preference service: all database access for user preferences."""

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.item import Item  # adjust path to your Item model
from app.models.preferences import (
    PrefLevel,
    UserAllergyItem,
    UserAllergyLabel,
    UserItemPreference,
)
from app.schemas.preferences import (
    AllergyItemAdd,
    AllergyItemDelete,
    AllergyLabelAdd,
    AllergyLabelDelete,
    ItemPreferenceAdd,
    ItemPreferenceDelete,
    UserPreferencesOut,
    ItemOut
)


# ---------- Internal helpers ----------

def _ensure_items_exist(db: Session, item_ids: list[int]) -> None:
    found = set(db.execute(select(Item.id).where(Item.id.in_(item_ids))).scalars())
    missing = sorted(set(item_ids) - found)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown item id(s): {missing}",
        )


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid preference data",
        )


# ---------- Read ----------

def get_preferences(db: Session, user_id: int) -> UserPreferencesOut:
    pref_rows = db.execute(
        select(Item, UserItemPreference.pref)
        .join(UserItemPreference, UserItemPreference.item_id == Item.id)
        .where(UserItemPreference.user_id == user_id)
        .order_by(Item.name)
    ).all()

    allergy_items = db.execute(
        select(Item)
        .join(UserAllergyItem, UserAllergyItem.item_id == Item.id)
        .where(UserAllergyItem.user_id == user_id)
        .order_by(Item.name)
    ).scalars().all()

    allergy_labels = db.execute(
        select(UserAllergyLabel.label)
        .where(UserAllergyLabel.user_id == user_id)
        .order_by(UserAllergyLabel.label)
    ).scalars().all()

    return UserPreferencesOut(
        preferred=[
            ItemOut.model_validate(item)
            for item, pref in pref_rows
            if pref == PrefLevel.PREFERRED
        ],
        restricted=[
            ItemOut.model_validate(item)
            for item, pref in pref_rows
            if pref == PrefLevel.RESTRICTED
        ],
        allergy_items=[ItemOut.model_validate(i) for i in allergy_items],
        allergy_labels=list(allergy_labels),
    )


# ---------- Preferred / restricted items ----------

def add_item_preferences(
    db: Session, user_id: int, body: ItemPreferenceAdd
) -> UserPreferencesOut:
    """Upsert preferred/restricted items."""
    _ensure_items_exist(db, [p.item_id for p in body.preferences])

    stmt = insert(UserItemPreference).values(
        [
            {"user_id": user_id, "item_id": p.item_id, "pref": p.pref}
            for p in body.preferences
        ]
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["user_id", "item_id"],
        set_={"pref": stmt.excluded.pref},
    )
    db.execute(stmt)
    _commit(db)
    return get_preferences(db, user_id)


def delete_item_preferences(
    db: Session, user_id: int, body: ItemPreferenceDelete
) -> UserPreferencesOut:
    """Set items back to neutral. Unknown IDs are ignored."""
    db.execute(
        delete(UserItemPreference).where(
            UserItemPreference.user_id == user_id,
            UserItemPreference.item_id.in_(body.item_ids),
        )
    )
    _commit(db)
    return get_preferences(db, user_id)


# ---------- Allergy items ----------

def add_allergy_items(
    db: Session, user_id: int, body: AllergyItemAdd
) -> UserPreferencesOut:
    _ensure_items_exist(db, body.item_ids)

    stmt = (
        insert(UserAllergyItem)
        .values([{"user_id": user_id, "item_id": i} for i in body.item_ids])
        .on_conflict_do_nothing()
    )
    db.execute(stmt)
    _commit(db)
    return get_preferences(db, user_id)


def delete_allergy_items(
    db: Session, user_id: int, body: AllergyItemDelete
) -> UserPreferencesOut:
    db.execute(
        delete(UserAllergyItem).where(
            UserAllergyItem.user_id == user_id,
            UserAllergyItem.item_id.in_(body.item_ids),
        )
    )
    _commit(db)
    return get_preferences(db, user_id)


# ---------- Allergy labels ----------

def add_allergy_labels(
    db: Session, user_id: int, body: AllergyLabelAdd
) -> UserPreferencesOut:
    stmt = (
        insert(UserAllergyLabel)
        .values([{"user_id": user_id, "label": label} for label in body.labels])
        .on_conflict_do_nothing()
    )
    db.execute(stmt)
    _commit(db)
    return get_preferences(db, user_id)


def delete_allergy_labels(
    db: Session, user_id: int, body: AllergyLabelDelete
) -> UserPreferencesOut:
    db.execute(
        delete(UserAllergyLabel).where(
            UserAllergyLabel.user_id == user_id,
            UserAllergyLabel.label.in_(body.labels),
        )
    )
    _commit(db)
    return get_preferences(db, user_id)