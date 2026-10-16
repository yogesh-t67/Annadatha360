from pydantic import BaseModel


class CropOut(BaseModel):
    code: str
    name: str
    category: str
