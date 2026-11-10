from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str = Field(min_length=1, max_length=50)
    surname: str = Field(min_length=1, max_length=50)
    user_name: str = Field(min_length=1, max_length=30)

    @field_validator("password")
    @classmethod
    def bcrypt_limit(cls, v: str) -> str:
        if len(v.encode()) > 72:
            raise ValueError("Password too long!")
        return v

    @field_validator("name", "surname", "user_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name fields must not be blank")
        return v


class UserLogin(BaseModel):
    # plain str on purpose: a malformed email at login is just "bad credentials" (401)
    email: str
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    name: str
    surname: str
    user_name: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"