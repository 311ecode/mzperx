#!/usr/bin/env python3
"""Normalize wijklijst JSON by merging duplicate streets."""
import json
import sys
from collections import OrderedDict

with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = json.load(f)

# Merge duplicate streets
street_map = OrderedDict()
for entry in data.get("delivery_route", []):
    key = (entry["street"], entry["city"])
    if key not in street_map:
        street_map[key] = {"street": entry["street"], "city": entry["city"], "deliveries": []}
    street_map[key]["deliveries"].extend(entry["deliveries"])

data["delivery_route"] = list(street_map.values())

with open(sys.argv[1], 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
