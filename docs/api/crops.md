# Crops

Reference list for crop pickers (onboarding primary crop, field crop). Crops are identified everywhere by `code`.

## GET /crops?lang=te

Public — no token needed. `lang` defaults to `en`; untranslated names fall back to English.

**200**
```json
[
  { "code": "paddy", "name": "వరి", "category": "cereal" },
  { "code": "cotton", "name": "పత్తి", "category": "commercial" }
]
```

Sorted by category, then code. Categories: `cereal` `pulse` `oilseed` `commercial` `spice` `vegetable` `fruit`.

Current list (19): paddy, maize, jowar, red_gram, bengal_gram, black_gram, green_gram, groundnut, sunflower,
castor, oil_palm, cotton, sugarcane, chilli, turmeric, tomato, onion, mango, banana. Names in `en` + `te`;
Telugu names are pending native-speaker review.
