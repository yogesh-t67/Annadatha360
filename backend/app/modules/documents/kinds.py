"""What kinds of private documents vendors upload, and which file types are accepted."""

DOCUMENT_KINDS: dict[str, str] = {
    "gst_certificate": "GST registration certificate",
    "pan_card": "PAN card",
    "fertilizer_licence": "Fertilizer dealer authorisation (FCO 1985)",
    "pesticide_licence": "Pesticide/insecticide sale licence",
    "seed_licence": "Seed dealer licence",
    "drone_pilot_certificate": "DGCA remote pilot certificate",
    "drone_uin": "DGCA drone registration (UIN)",
    "contract_labour_licence": "Contract labour licence",
    "vehicle_rc": "Vehicle registration (RC)",
    "cancelled_cheque": "Cancelled cheque / bank proof",
    "shop_photo": "Shop or business photo",
    "other": "Other document",
}

# Detected from the file's first bytes; the browser's content type and the file name are never trusted.
FILE_TYPES: dict[str, str] = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


def sniff_content_type(data: bytes) -> str | None:
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None
