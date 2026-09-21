from pydantic import BaseModel


class PreferencesOut(BaseModel):
    theme_preset: str
    mode: str

    model_config = {"from_attributes": True}


class PreferencesUpdate(BaseModel):
    theme_preset: str | None = None
    mode: str | None = None
