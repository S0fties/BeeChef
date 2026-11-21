"""Unit tests for temporary receipt storage (UC-13)."""

import os
import time
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.services.receipt_storage import ReceiptStorage

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16


@pytest.fixture
def store(tmp_path):
    return ReceiptStorage(tmp_path / "receipts", ttl_minutes=60)


def age(path, seconds):
    past = time.time() - seconds
    os.utime(path, (past, past))


def test_save_writes_file_in_household_folder(store):
    receipt_id = store.save(7, PNG, "image/png")

    path = store.base_dir / "7" / f"{receipt_id.hex}.png"
    assert path.read_bytes() == PNG


def test_load_returns_bytes_and_media_type(store):
    receipt_id = store.save(7, PNG, "image/png")
    assert store.load(7, receipt_id) == (PNG, "image/png")


def test_load_from_another_household_is_not_found(store):
    receipt_id = store.save(7, PNG, "image/png")
    with pytest.raises(HTTPException) as exc:
        store.load(8, receipt_id)
    assert exc.value.status_code == 404


def test_load_unknown_receipt_is_not_found(store):
    with pytest.raises(HTTPException) as exc:
        store.load(7, uuid4())
    assert exc.value.status_code == 404


def test_load_expired_receipt_deletes_it(store):
    receipt_id = store.save(7, PNG, "image/png")
    path = next(store.base_dir.glob("7/*"))
    age(path, 2 * 3600)

    with pytest.raises(HTTPException) as exc:
        store.load(7, receipt_id)

    assert exc.value.status_code == 404
    assert not path.exists()


def test_delete_removes_file_and_is_idempotent(store):
    receipt_id = store.save(7, PNG, "image/png")
    store.delete(7, receipt_id)
    store.delete(7, receipt_id)
    assert list(store.base_dir.glob("7/*")) == []


def test_purge_expired_removes_only_abandoned_receipts(store):
    old_id = store.save(7, PNG, "image/png")
    fresh_id = store.save(8, PNG, "image/png")
    age(store.base_dir / "7" / f"{old_id.hex}.png", 2 * 3600)

    removed = store.purge_expired()

    assert removed == 1
    assert store.load(8, fresh_id)[0] == PNG


def test_purge_expired_with_no_folder_is_a_no_op(tmp_path):
    store = ReceiptStorage(tmp_path / "missing", ttl_minutes=60)
    assert store.purge_expired() == 0
