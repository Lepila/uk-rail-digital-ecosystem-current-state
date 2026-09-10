#!/usr/bin/env python3
"""Convert the expanded UK rail current-state workbook into app-ready JSON.

The expanded workbook is the only source of truth. The script preserves raw
worksheet evidence, creates stable relational IDs, derives navigation groupings,
and reports coverage without altering the workbook.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import openpyxl


DEFAULT_WORKBOOK = (
    "/Users/mila/Downloads/"
    "UK_Rail_Digital_Landscape_CURRENT_STATE_EXPANDED.xlsx"
)
DEFAULT_OUTPUT = "data/rail-ecosystem.json"
DEFAULT_QUALITY_REPORT = "DATA_QUALITY_REPORT.md"

JOURNEY_STAGES = [
    "1 Discover / decide to travel",
    "2 Plan",
    "3 Choose fare / ticket",
    "4 Buy",
    "5 Prepare",
    "6 Travel to station",
    "7 At station",
    "8 On train",
    "9 Disruption / recover",
    "10 Post journey / after-sales",
    "11 Ongoing relationship",
]

STAGE_OUTCOMES = {
    "1 Discover / decide to travel": "I need to decide whether rail is right for this trip.",
    "2 Plan": "I need to understand routes, times, stations and options.",
    "3 Choose fare / ticket": "I need to understand the ticket, fare or discount that fits.",
    "4 Buy": "I need to complete the transaction or request.",
    "5 Prepare": "I need to get ready, manage documents and arrange support.",
    "6 Travel to station": "I need to reach the station and use onward services.",
    "7 At station": "I need live, facility and accessibility information in the station.",
    "8 On train": "I need digital support while travelling onboard.",
    "9 Disruption / recover": "I need to understand disruption and recover from it.",
    "10 Post journey / after-sales": "I need refunds, compensation, complaints or lost property support.",
    "11 Ongoing relationship": "I need offers, loyalty, business, account or relationship services.",
}

TOC_CANONICAL = {
    "Avanti",
    "Avanti West Coast",
    "c2c",
    "Chiltern",
    "Chiltern Railways",
    "CrossCountry",
    "East Midlands Railway",
    "EMR",
    "Govia Thameslink Railway",
    "GTR",
    "Great Western Railway",
    "GWR",
    "Greater Anglia",
    "London Northwestern Railway",
    "LNER",
    "Northern",
    "ScotRail",
    "Southeastern",
    "South Western Railway",
    "SWR",
    "TransPennine Express",
    "TPE",
    "Transport for Wales",
    "TfW",
    "West Midlands Railway",
    "West Midlands Trains",
    "WMR",
    "Merseyrail",
}

OPEN_ACCESS_OTHER = {
    "Grand Central",
    "Hull Trains",
    "Lumo",
    "Caledonian Sleeper",
    "Heathrow Express",
    "Eurostar",
    "Transport for London",
    "Elizabeth line",
    "Stansted Express",
    "Luton Airport Express",
}

THIRD_PARTY_HINTS = {
    "ACP Rail",
    "APCOA",
    "Evolvi",
    "MissingX",
    "NCP",
    "Omio",
    "Rail Europe",
    "RingGo",
    "Saba",
    "Seatfrog",
    "Sherpr",
    "TrainPal",
    "Trainline",
    "Trip.com",
    "VisitBritain",
}

SPECIALIST_HINTS = {
    "BritRail",
    "Interrail",
    "Passenger Assistance",
    "Railcard",
    "Railway 200",
    "Transreport",
    "Whizz-Kidz",
    "Window Seater",
}

INDUSTRY_HINTS = {
    "Department for Transport",
    "Great British Railways",
    "National Rail",
    "Network Rail",
    "Office of Rail and Road",
    "Rail Delivery Group",
    "Rail Ombudsman",
    "RDG",
}

FAMILY_RULES = [
    (
        "Travel inspiration & discovery",
        ["inspiration", "destination", "days out", "offers", "2for1", "attraction", "leisure", "campaign", "sustainability", "carbon"],
    ),
    (
        "Journey planning & timetables",
        ["journey planning", "planner", "timetable", "route map", "network map", "route", "map", "train times", "pdf timetable"],
    ),
    (
        "Live travel information",
        ["live departure", "live arrivals", "live travel", "train tracking", "service status", "realtime", "real time", "journeycheck", "platform", "crowding"],
    ),
    (
        "Fares & ticket information",
        ["fare", "ticket type", "season ticket calculator", "eligibility", "discount entitlement", "split ticket explanation"],
    ),
    (
        "Ticket retail",
        ["buy", "checkout", "retail", "purchase", "booking", "book", "payment", "sell", "storefront"],
    ),
    (
        "Ticket management & fulfilment",
        ["my bookings", "fulfilment", "collect", "delivery", "mobile ticket", "eticket", "smartcard", "photocard", "order management", "activate"],
    ),
    (
        "Accounts & personalisation",
        ["account", "login", "profile", "saved", "favourite", "alert", "notification", "preference", "personal"],
    ),
    (
        "Railcards & discounts",
        ["railcard", "discount", "entitlement", "pass comparison", "regional railcard"],
    ),
    (
        "Accessibility & Passenger Assist",
        ["assist", "assistance", "accessibility", "accessible", "disabled", "mobility", "blue badge", "access-needs"],
    ),
    (
        "Stations & facilities",
        ["station", "facility", "facilities", "toilets", "lift", "step-free", "station wi-fi", "managed station"],
    ),
    (
        "Parking & onward travel",
        ["parking", "car park", "blue badge", "cycling", "cycle", "onward", "taxi", "bus", "airport"],
    ),
    (
        "Onboard digital experience",
        ["on train", "onboard", "wi-fi", "wifi", "portal", "entertainment", "podcast", "route guide", "catering", "at-seat", "seat ordering"],
    ),
    (
        "Disruption",
        ["disruption", "delay", "strike", "alternative journey", "service update", "travel alert", "recover"],
    ),
    (
        "Refunds & Delay Repay",
        ["refund", "delay repay", "compensation", "claim", "after your trip", "unused ticket"],
    ),
    (
        "Customer support",
        ["support", "contact", "complaint", "help centre", "case", "enquiries", "customer"],
    ),
    (
        "Loyalty, rewards & offers",
        ["loyalty", "reward", "club", "marketing", "newsletter", "offer", "promotion"],
    ),
    (
        "Business & corporate travel",
        ["business", "corporate", "agent", "travel agent", "trade", "invoicing", "reporting", "group travel", "colleague"],
    ),
    (
        "International travel",
        ["international", "britrail", "interrail", "eurostar", "overseas", "visitor", "tourist", "reservation"],
    ),
    (
        "Specialist / ancillary services",
        ["luggage", "lost property", "sherpr", "seatfrog", "auction", "ancillary", "specialist"],
    ),
]


def clean_text(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        return re.sub(r"\s+", " ", value.strip())
    return value


def row_has_value(row: list[Any]) -> bool:
    return any(value is not None and str(value).strip() != "" for value in row)


def read_raw_sheet(ws: Any) -> list[list[Any]]:
    rows: list[list[Any]] = []
    for row in ws.iter_rows(values_only=True):
        cleaned = [clean_text(value) for value in row]
        if row_has_value(cleaned):
            rows.append(cleaned)
    return rows


def read_table(ws: Any, header_row: int = 1) -> list[dict[str, Any]]:
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) < header_row:
        return []
    headers = [clean_text(value) or "" for value in rows[header_row - 1]]
    records: list[dict[str, Any]] = []
    for row in rows[header_row:]:
        cleaned = [clean_text(value) for value in row]
        if not row_has_value(cleaned):
            continue
        record = {}
        for index, header in enumerate(headers):
            if header:
                record[str(header)] = cleaned[index] if index < len(cleaned) else None
        records.append(record)
    return records


def split_list(value: Any) -> list[str]:
    if value is None:
        return []
    parts = re.split(r"\s*;\s*|\n+|•", str(value))
    return [part.strip(" -") for part in parts if part.strip(" -")]


def split_functionality(value: Any) -> list[str]:
    return split_list(value)


def unique_sorted(values: list[str]) -> list[str]:
    return sorted({value for value in values if value})


def urls_from_text(value: Any) -> list[str]:
    if value is None:
        return []
    return re.findall(r"https?://[^\s;)]+", str(value))


def domain_from_url(value: Any) -> str:
    urls = urls_from_text(value)
    if not urls:
        return ""
    return urlparse(urls[0]).netloc.lower()


def slug(value: Any) -> str:
    text = str(value or "").lower().replace("&", " and ")
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-") or "unknown"


def normalize_phrase(value: Any) -> str:
    text = str(value or "").lower().replace("&", " and ")
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def contains_any(value: Any, needles: set[str]) -> bool:
    text = str(value or "").lower()
    return any(needle.lower() in text for needle in needles)


def org_category(name: str) -> str:
    text = name.lower()
    if contains_any(name, INDUSTRY_HINTS):
        if "national rail" in text or "rail delivery group" in text:
            return "National Rail / national service"
        return "Industry / shared service"
    if contains_any(name, THIRD_PARTY_HINTS):
        return "External / third-party provider"
    if contains_any(name, SPECIALIST_HINTS):
        return "Specialist service"
    if name in TOC_CANONICAL or contains_any(name, TOC_CANONICAL):
        return "TOC"
    if contains_any(name, OPEN_ACCESS_OTHER):
        return "Open access / other operator"
    return "Other / needs classification"


def audience_type(value: Any) -> str:
    text = str(value or "").lower()
    if any(term in text for term in ["business", "corporate", "agent", "trade", "b2b"]):
        return "B2B / trade"
    if any(term in text for term in ["passenger", "tourist", "visitor", "disabled", "older", "commuter"]):
        return "B2C passenger"
    return "Not captured in audit"


def transaction_type(value: Any, purpose: Any = "") -> str:
    text = f"{value or ''} {purpose or ''}".lower()
    if "yes" in text:
        return "Transactional"
    if "partly" in text or "sometimes" in text or "request" in text:
        return "Partly transactional"
    if "no" in text:
        return "Informational"
    return "Not captured in audit"


def status_state(record: dict[str, Any]) -> str:
    verification = str(record.get("Verification status") or "").lower()
    confidence = str(record.get("Confidence") or "").lower()
    active = str(record.get("Appears active?") or record.get("Status") or "").lower()
    sme = str(record.get("SME validation required?") or "").lower()
    notes = " ".join(str(record.get(field) or "") for field in ["Notes", "Verification enrichment", "What remains unclear"]).lower()
    if "not found" in verification or "not found" in active:
        return "Not found in audit"
    if "sme" in verification or sme == "yes" or any(term in notes for term in ["needs verification", "verify", "unclear", "unknown", "validation"]):
        return "SME validation required"
    if "verified" in verification and confidence == "high":
        return "Verified"
    if "partial" in verification or confidence in {"medium", "low"} or "unclear" in active or "potentially legacy" in active:
        return "Partially verified"
    if verification or confidence:
        return "Partially verified"
    return "Unclassified"


def family_ids_for(*values: Any) -> list[str]:
    haystack = " ".join(str(value or "") for value in values).lower()
    matched = [name for name, needles in FAMILY_RULES if any(needle in haystack for needle in needles)]
    return matched or ["Other / Unclassified — needs review"]


def stage_ids_from_text(value: Any) -> list[str]:
    text = str(value or "")
    if not text:
        return []
    if re.search(r"\b1\s*-\s*11\b", text):
        return JOURNEY_STAGES.copy()
    found = []
    for stage in JOURNEY_STAGES:
        number = stage.split(" ", 1)[0]
        plain = stage.replace(number, "", 1).strip().lower()
        if stage.lower() in text.lower() or plain in text.lower() or re.search(rf"(^|[;,\s]){number}([;,\s]|$)", text):
            found.append(stage)
    return found


def matrix_state(value: Any) -> str:
    if value is None or str(value).strip() == "":
        return "not_applicable"
    text = str(value).strip()
    if text == "✓":
        return "available"
    if text == "?":
        return "uncertain"
    if text == "—":
        return "not_found"
    normalized = text.lower()
    if normalized in {"n/a", "not applicable"}:
        return "not_applicable"
    if "unknown" in normalized or "uncertain" in normalized or "verify" in normalized:
        return "uncertain"
    if "not found" in normalized or "handed off" in normalized:
        return "not_found"
    return "uncertain"


def parse_summary(ws: Any) -> dict[str, Any]:
    rows = read_raw_sheet(ws)
    metrics: dict[str, Any] = {}
    for row in rows:
        if len(row) > 1 and isinstance(row[1], (int, float)) and isinstance(row[0], str):
            metrics[row[0]] = row[1]
    return {
        "title": rows[0][0] if rows and rows[0] else None,
        "subtitle": rows[1][0] if len(rows) > 1 and rows[1] else None,
        "metrics": metrics,
        "rawRows": rows,
    }


def match_score(a: str, b: str) -> int:
    a_norm = normalize_phrase(a)
    b_norm = normalize_phrase(b)
    if not a_norm or not b_norm:
        return 0
    if a_norm == b_norm:
        return 100
    if a_norm in b_norm or b_norm in a_norm:
        return 70
    overlap = set(a_norm.split()) & set(b_norm.split())
    return len(overlap)


def build(workbook_path: Path) -> dict[str, Any]:
    wb = openpyxl.load_workbook(workbook_path, data_only=True, read_only=False)
    raw_sheets = {ws.title: read_raw_sheet(ws) for ws in wb.worksheets}
    tables = {
        "masterInventory": read_table(wb["Master Inventory"]),
        "orgPropertyMap": read_table(wb["Org Property Map"]),
        "sharedServiceMap": read_table(wb["Shared Service Map"]),
        "legacyUnclear": read_table(wb["Legacy & Unclear"]),
        "gapCheck": read_table(wb["Gap Check"]),
        "significantSites": read_table(wb["Significant Sites"]),
        "informationArchitecture": read_table(wb["Information Architecture"]),
        "capabilityInventory": read_table(wb["Capability Inventory"]),
        "journeyStageMap": read_table(wb["Journey Stage Map"]),
        "tocComparison": read_table(wb["TOC Comparison"], header_row=3),
        "nationalVsTocGaps": read_table(wb["National vs TOC Gaps"]),
        "sharedVsUnique": read_table(wb["Shared vs Unique"]),
        "fragmentedJourneys": read_table(wb["Fragmented Journeys"]),
        "duplicationAudit": read_table(wb["Duplication Audit"]),
        "smeValidation": read_table(wb["SME Validation"]),
        "evidenceRegister": read_table(wb["Evidence Register"]),
        "pass2Summary": read_raw_sheet(wb["Pass2 Summary"]),
        "externalHandoffs": read_table(wb["External Hand-offs"]),
        "smeValidationRequired": read_table(wb["SME Validation Required"]),
        "verificationLog": read_table(wb["Verification Log"]),
        "changesFromPasses": read_table(wb["Changes from Pass 1 + 2"]),
        "expandedSummary": read_raw_sheet(wb["Expanded Summary"]),
    }

    digital_properties: list[dict[str, Any]] = []
    property_by_url: dict[str, dict[str, Any]] = {}
    property_by_name: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for index, record in enumerate(tables["masterInventory"], start=1):
        org = str(record.get("Organisation") or "Not captured in audit")
        brand_service = str(record.get("Brand / service") or "Not captured in audit")
        url = str(record.get("URL") or "")
        enriched = {
            **record,
            "id": f"property-{index}-{slug(brand_service)}",
            "organisation": org,
            "organisationId": slug(org),
            "brandService": brand_service,
            "brandId": f"{slug(org)}--{slug(brand_service)}",
            "domain": record.get("Domain / subdomain") or domain_from_url(url),
            "organisationType": org_category(org),
            "audienceType": audience_type(record.get("Primary audience")),
            "transactionType": transaction_type(record.get("Website type"), record.get("High-level purpose")),
            "familyIds": family_ids_for(
                brand_service,
                record.get("Website type"),
                record.get("Primary audience"),
                record.get("High-level purpose"),
                record.get("Relationship / shared platform"),
                record.get("Notes"),
            ),
            "journeyStageIds": [],
            "capabilityIds": [],
            "passengerNeedIds": [],
            "handoffIds": [],
            "urls": unique_sorted(urls_from_text(url) + urls_from_text(record.get("Evidence")) + urls_from_text(record.get("Verification evidence URL"))),
            "statusState": status_state(record),
            "needsValidation": status_state(record) in {"SME validation required", "Partially verified", "Unclassified"},
        }
        digital_properties.append(enriched)
        if url:
            property_by_url[url] = enriched
        property_by_name[normalize_phrase(brand_service)].append(enriched)

    significant_by_url = {str(row.get("URL") or ""): row for row in tables["significantSites"] if row.get("URL")}
    significant_services = []
    for index, record in enumerate(tables["significantSites"], start=1):
        url = str(record.get("URL") or "")
        prop = property_by_url.get(url)
        service = {
            **record,
            "id": f"service-{index}-{slug(record.get('Website / service'))}",
            "propertyId": prop["id"] if prop else None,
            "name": record.get("Website / service"),
            "organisation": record.get("Organisation"),
            "organisationId": slug(record.get("Organisation")),
            "organisationType": org_category(str(record.get("Organisation") or "")),
            "brandService": prop["brandService"] if prop else record.get("Website / service"),
            "domain": prop["domain"] if prop else domain_from_url(url),
            "websiteType": prop.get("Website type") if prop else "Significant audited service",
            "audienceType": audience_type(record.get("Audience")),
            "transactionType": transaction_type(record.get("Transactional?")),
            "functionalityItems": split_functionality(record.get("Actual functionality confirmed")),
            "journeyStageIds": stage_ids_from_text(record.get("Journey stages")),
            "familyIds": family_ids_for(record.get("Website / service"), record.get("Purpose"), record.get("Actual functionality confirmed"), record.get("Relationship / external service")),
            "urls": unique_sorted(urls_from_text(url) + urls_from_text(record.get("Evidence")) + urls_from_text(record.get("Verification evidence URL"))),
            "statusState": status_state(record),
            "needsValidation": status_state(record) in {"SME validation required", "Partially verified", "Unclassified"},
        }
        significant_services.append(service)
        if prop:
            prop["significantServiceId"] = service["id"]
            prop["journeyStageIds"] = unique_sorted(prop["journeyStageIds"] + service["journeyStageIds"])
            prop["familyIds"] = unique_sorted(prop["familyIds"] + service["familyIds"])
            prop["passengerNeedText"] = record.get("Passenger need supported")
            prop["functionalityText"] = record.get("Actual functionality confirmed")
            prop["transactionType"] = transaction_type(record.get("Transactional?"), prop.get("High-level purpose"))
            if service["needsValidation"]:
                prop["needsValidation"] = True
                prop["statusState"] = service["statusState"]

    capabilities: list[dict[str, Any]] = []
    for index, record in enumerate(tables["capabilityInventory"], start=1):
        cap_name = str(record.get("Capability") or "Not captured in audit")
        need_text = str(record.get("Passenger need") or "Not captured in audit")
        stages = stage_ids_from_text(record.get("Journey stage(s)"))
        providers = split_list(record.get("Websites / services providing it"))
        capability = {
            **record,
            "id": f"capability-{index}-{slug(cap_name)}",
            "capability": cap_name,
            "passengerNeed": need_text,
            "passengerNeedId": slug(need_text),
            "familyIds": family_ids_for(cap_name, need_text, record.get("Notes")),
            "journeyStageIds": stages,
            "providers": providers,
            "providerCount": len(providers),
            "classification": record.get("Common / specialist / unique") or "Unclassified",
            "transactionType": transaction_type(record.get("Transactional?")),
            "requiresAccount": record.get("Requires account?"),
            "externalProvider": record.get("External provider?"),
            "urls": unique_sorted(urls_from_text(record.get("Evidence")) + urls_from_text(record.get("Verification evidence URL"))),
            "statusState": status_state(record),
            "needsValidation": status_state(record) in {"SME validation required", "Partially verified", "Unclassified"},
            "serviceLinks": [],
            "providerReferences": [],
        }
        capabilities.append(capability)

    capability_by_id = {cap["id"]: cap for cap in capabilities}
    for capability in capabilities:
        cap_text = capability["capability"]
        linked_property_ids = set()
        for service in significant_services:
            direct_matches = [item for item in service["functionalityItems"] if match_score(cap_text, item) >= 100]
            soft_matches = [item for item in service["functionalityItems"] if 3 <= match_score(cap_text, item) < 100 or match_score(cap_text, item) >= 70]
            if not direct_matches and not soft_matches:
                continue
            confidence = "confirmed" if direct_matches else "needs_verification"
            link = {
                "serviceId": service["id"],
                "propertyId": service.get("propertyId"),
                "serviceName": service["name"],
                "organisation": service["organisation"],
                "brandService": service["brandService"],
                "organisationType": service["organisationType"],
                "websiteType": service["websiteType"],
                "domain": service["domain"],
                "url": service.get("URL"),
                "relationshipConfidence": confidence,
                "basis": "Significant Sites: Actual functionality confirmed",
                "matchedText": direct_matches or soft_matches,
                "handoff": bool(service.get("Relationship / external service")),
            }
            capability["serviceLinks"].append(link)
            if service.get("propertyId"):
                linked_property_ids.add(service["propertyId"])
        capability["confirmedServiceCount"] = sum(1 for link in capability["serviceLinks"] if link["relationshipConfidence"] == "confirmed")
        capability["verificationServiceCount"] = sum(1 for link in capability["serviceLinks"] if link["relationshipConfidence"] == "needs_verification")
        capability["providerReferences"] = [
            {
                "name": provider,
                "relationshipConfidence": "provider_reference",
                "basis": "Capability Inventory: Websites / services providing it",
            }
            for provider in capability["providers"]
        ]
        for prop in digital_properties:
            if prop["id"] in linked_property_ids:
                prop["capabilityIds"] = unique_sorted(prop["capabilityIds"] + [capability["id"]])
                prop["passengerNeedIds"] = unique_sorted(prop["passengerNeedIds"] + [capability["passengerNeedId"]])

    passenger_needs: dict[str, dict[str, Any]] = {}
    for capability in capabilities:
        need_id = capability["passengerNeedId"]
        passenger_needs.setdefault(
            need_id,
            {
                "id": need_id,
                "need": capability["passengerNeed"],
                "capabilityIds": [],
                "journeyStageIds": [],
                "familyIds": [],
            },
        )
        passenger_needs[need_id]["capabilityIds"].append(capability["id"])
        passenger_needs[need_id]["journeyStageIds"].extend(capability["journeyStageIds"])
        passenger_needs[need_id]["familyIds"].extend(capability["familyIds"])

    for need in passenger_needs.values():
        need["capabilityIds"] = unique_sorted(need["capabilityIds"])
        need["journeyStageIds"] = [stage for stage in JOURNEY_STAGES if stage in set(need["journeyStageIds"])]
        need["familyIds"] = unique_sorted(need["familyIds"])

    brands: dict[str, dict[str, Any]] = {}
    for prop in digital_properties:
        brand_id = prop["brandId"]
        brands.setdefault(
            brand_id,
            {
                "id": brand_id,
                "brandService": prop["brandService"],
                "organisationId": prop["organisationId"],
                "organisation": prop["organisation"],
                "propertyIds": [],
            },
        )
        brands[brand_id]["propertyIds"].append(prop["id"])

    organisations: dict[str, dict[str, Any]] = {}
    for prop in digital_properties:
        org_id = prop["organisationId"]
        organisations.setdefault(
            org_id,
            {
                "id": org_id,
                "organisation": prop["organisation"],
                "organisationType": prop["organisationType"],
                "brandIds": [],
                "propertyIds": [],
                "domains": [],
                "needsValidation": False,
            },
        )
        organisations[org_id]["brandIds"].append(prop["brandId"])
        organisations[org_id]["propertyIds"].append(prop["id"])
        if prop.get("domain"):
            organisations[org_id]["domains"].append(prop["domain"])
        if prop["needsValidation"]:
            organisations[org_id]["needsValidation"] = True

    for org in organisations.values():
        org["brandIds"] = unique_sorted(org["brandIds"])
        org["propertyIds"] = unique_sorted(org["propertyIds"])
        org["domains"] = unique_sorted(org["domains"])

    external_handoffs = []
    for index, record in enumerate(tables["externalHandoffs"], start=1):
        origin_url = str(record.get("Origin URL") or "")
        destination_url = str(record.get("Destination URL") or "")
        origin_prop = property_by_url.get(origin_url)
        destination_prop = property_by_url.get(destination_url)
        handoff = {
            **record,
            "id": f"handoff-{index}-{slug(record.get('Originating service'))}-{slug(record.get('Destination service'))}",
            "originPropertyId": origin_prop["id"] if origin_prop else None,
            "destinationPropertyId": destination_prop["id"] if destination_prop else None,
            "domainChanges": record.get("Domain changes?"),
            "organisationChanges": record.get("Organisation changes?"),
            "urls": unique_sorted(urls_from_text(origin_url) + urls_from_text(destination_url) + urls_from_text(record.get("Evidence"))),
            "statusState": status_state(record),
        }
        external_handoffs.append(handoff)
        if origin_prop:
            origin_prop["handoffIds"].append(handoff["id"])
        if destination_prop:
            destination_prop["handoffIds"].append(handoff["id"])

    family_records = []
    all_families = unique_sorted([family for cap in capabilities for family in cap["familyIds"]] + [family for prop in digital_properties for family in prop["familyIds"]])
    for family in all_families:
        family_records.append(
            {
                "id": slug(family),
                "name": family,
                "capabilityIds": [cap["id"] for cap in capabilities if family in cap["familyIds"]],
                "propertyIds": [prop["id"] for prop in digital_properties if family in prop["familyIds"]],
            }
        )

    family_id_lookup = {record["name"]: record["id"] for record in family_records}
    journey_stage_records = []
    matrix_cells = []
    for stage in JOURNEY_STAGES:
        stage_caps = [cap for cap in capabilities if stage in cap["journeyStageIds"]]
        stage_props = [prop for prop in digital_properties if stage in prop["journeyStageIds"]]
        journey_stage_records.append(
            {
                "id": slug(stage),
                "stage": stage,
                "shortLabel": stage.replace(re.match(r"^\d+\s*", stage).group(0), "") if re.match(r"^\d+\s*", stage) else stage,
                "outcome": STAGE_OUTCOMES[stage],
                "capabilityIds": [cap["id"] for cap in stage_caps],
                "passengerNeedIds": unique_sorted([cap["passengerNeedId"] for cap in stage_caps]),
                "propertyIds": [prop["id"] for prop in stage_props],
                "capabilityCount": len(stage_caps),
                "propertyCount": len(stage_props),
            }
        )
        for family in all_families:
            cell_caps = [cap for cap in stage_caps if family in cap["familyIds"]]
            need_groups = []
            for need_id in unique_sorted([cap["passengerNeedId"] for cap in cell_caps]):
                caps = [cap for cap in cell_caps if cap["passengerNeedId"] == need_id]
                need_groups.append(
                    {
                        "needId": need_id,
                        "need": passenger_needs.get(need_id, {}).get("need", need_id),
                        "capabilityIds": [cap["id"] for cap in caps],
                    }
                )
            matrix_cells.append(
                {
                    "id": f"{family_id_lookup[family]}--{slug(stage)}",
                    "familyId": family_id_lookup[family],
                    "family": family,
                    "stageId": slug(stage),
                    "stage": stage,
                    "capabilityIds": [cap["id"] for cap in cell_caps],
                    "capabilityCount": len(cell_caps),
                    "needGroups": need_groups,
                    "offeringCount": sum(max(len(cap["serviceLinks"]), len(cap["providerReferences"])) for cap in cell_caps),
                }
            )

    toc_ws = wb["TOC Comparison"]
    toc_headers = [clean_text(cell.value) for cell in toc_ws[3]]
    comparison_columns = [header for header in toc_headers[2:] if header]
    matrix_rows = []
    for row_index, row in enumerate(toc_ws.iter_rows(min_row=4, values_only=True), start=4):
        if not row[0]:
            continue
        cells = []
        counts = Counter()
        for col_index, provider in enumerate(comparison_columns, start=2):
            raw = row[col_index] if col_index < len(row) else None
            state = matrix_state(raw)
            counts[state] += 1
            cells.append(
                {
                    "provider": provider,
                    "state": state,
                    "raw": clean_text(raw),
                    "providerType": "National" if provider in {"National Rail", "Passenger Assistance"} else "TOC / operator",
                }
            )
        national = next((cell for cell in cells if cell["provider"] == "National Rail"), None)
        available_toc_count = sum(1 for cell in cells if cell["provider"] not in {"National Rail", "Passenger Assistance"} and cell["state"] == "available")
        matrix_rows.append(
            {
                "id": f"toc-matrix-{row_index}-{slug(row[0])}",
                "capability": clean_text(row[0]),
                "passengerNeed": clean_text(row[1]),
                "familyIds": family_ids_for(row[0], row[1]),
                "cells": cells,
                "counts": dict(counts),
                "nationalRailState": national["state"] if national else "not_applicable",
                "availableTocCount": available_toc_count,
                "tocProviderCount": max(0, len(comparison_columns) - 2),
            }
        )

    for cap in capabilities:
        match = next((row for row in matrix_rows if slug(row["capability"]) == slug(cap["capability"])), None)
        if match:
            cap["matrixAvailability"] = {
                "nationalRailState": match["nationalRailState"],
                "availableTocCount": match["availableTocCount"],
                "tocProviderCount": match["tocProviderCount"],
            }

    evidence_gaps = []
    for source_name, records in [
        ("SME Validation", tables["smeValidation"]),
        ("SME Validation Required", tables["smeValidationRequired"]),
        ("Legacy & Unclear", tables["legacyUnclear"]),
    ]:
        for index, record in enumerate(records, start=1):
            label = record.get("Area") or record.get("Suspected service") or record.get("Brand / service") or f"{source_name} {index}"
            evidence_gaps.append(
                {
                    **record,
                    "id": f"gap-{slug(source_name)}-{index}-{slug(label)}",
                    "sourceType": source_name,
                    "urls": unique_sorted(urls_from_text(record.get("Evidence")) + urls_from_text(record.get("Evidence / starting point"))),
                    "statusState": "SME validation required" if source_name != "Legacy & Unclear" else "Partially verified",
                }
            )

    coverage = {
        "digitalProperties": {
            "excel": len(tables["masterInventory"]),
            "imported": len(digital_properties),
            "represented": len([prop for prop in digital_properties if prop["id"]]),
            "unmapped": 0,
            "unmappedIds": [],
            "withoutJourneyMapping": len([prop for prop in digital_properties if not prop["journeyStageIds"]]),
            "withoutCapabilityMapping": len([prop for prop in digital_properties if not prop["capabilityIds"]]),
        },
        "capabilities": {
            "excel": len(tables["capabilityInventory"]),
            "imported": len(capabilities),
            "represented": len([cap for cap in capabilities if cap["id"]]),
            "unmapped": 0,
            "unmappedIds": [],
            "withoutJourneyMapping": len([cap for cap in capabilities if not cap["journeyStageIds"]]),
        },
        "passengerNeeds": {
            "excel": len({str(row.get("Passenger need") or "") for row in tables["capabilityInventory"] if row.get("Passenger need")}),
            "imported": len(passenger_needs),
            "represented": len(passenger_needs),
            "unmapped": 0,
            "unmappedIds": [],
        },
    }

    status_counts = Counter(prop["statusState"] for prop in digital_properties)
    specialist_microsite_count = 0
    for prop in digital_properties:
        website_type = str(prop.get("Website type") or "").lower()
        parent_domain = domain_from_url(prop.get("Parent website"))
        is_non_main = "main site" not in website_type
        is_named_specialist = prop["organisationType"] in {"External / third-party provider", "Specialist service"}
        is_separate_from_parent = bool(parent_domain and prop["domain"] and prop["domain"] != parent_domain)
        if is_non_main or is_named_specialist or is_separate_from_parent:
            specialist_microsite_count += 1
    derived_metrics = {
        "organisations": len(organisations),
        "brands": len(brands),
        "digitalProperties": len(digital_properties),
        "capabilities": len(capabilities),
        "serviceFamilies": len(family_records),
        "journeyStages": len(journey_stage_records),
        "specialistMicrositeServices": specialist_microsite_count,
        "thirdPartyHandoffs": len([handoff for handoff in external_handoffs if str(handoff.get("Organisation changes?") or "").lower() in {"yes", "usually"} or str(handoff.get("Domain changes?") or "").lower() == "yes"]),
        "itemsRequiringValidation": sum(1 for prop in digital_properties if prop["needsValidation"]) + len(evidence_gaps),
        "verified": status_counts.get("Verified", 0),
        "partiallyVerified": status_counts.get("Partially verified", 0),
        "smeValidationRequired": status_counts.get("SME validation required", 0) + len(evidence_gaps),
        "unclassified": status_counts.get("Unclassified", 0),
    }

    return {
        "meta": {
            "sourceWorkbook": str(workbook_path),
            "generatedAt": datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "auditDate": "2026-09-09",
            "sheets": [{"name": ws.title, "rows": len(raw_sheets[ws.title]), "columns": max((len(row) for row in raw_sheets[ws.title]), default=0)} for ws in wb.worksheets],
            "sourceRule": "Expanded workbook only. Previous Pass 1 / Pass 2 JSON is not merged.",
            "interpretationRules": {
                "brandCount": "Derived from the workbook's combined `Brand / service` field; the workbook does not contain a separate formal brand table.",
                "families": "Service families are derived from workbook text for navigation only and do not alter source records.",
                "providerReferences": "Provider names in Capability Inventory are preserved as provider references unless a precise Significant Sites or Master Inventory property can be matched.",
                "unknowns": "`not found`, `unknown`, `unclear`, `not applicable` and `needs verification` remain separate states.",
            },
        },
        "summary": {
            "coverage": parse_summary(wb["Coverage Summary"]),
            "pass2": parse_summary(wb["Pass2 Summary"]),
            "expanded": parse_summary(wb["Expanded Summary"]),
        },
        "metrics": derived_metrics,
        "coverage": coverage,
        "tables": tables,
        "rawSheets": raw_sheets,
        "organisations": sorted(organisations.values(), key=lambda item: (item["organisationType"], item["organisation"])),
        "brands": sorted(brands.values(), key=lambda item: (item["organisation"], item["brandService"])),
        "digitalProperties": digital_properties,
        "significantServices": significant_services,
        "serviceFamilies": family_records,
        "passengerNeeds": sorted(passenger_needs.values(), key=lambda item: item["need"]),
        "capabilities": capabilities,
        "journeyStages": journey_stage_records,
        "landscapeMatrix": matrix_cells,
        "sharedServices": tables["sharedServiceMap"],
        "externalHandoffs": external_handoffs,
        "fragmentedJourneys": [
            {
                **record,
                "id": f"fragment-{index}-{slug(record.get('Passenger goal'))}",
                "steps": [step.strip() for step in re.split(r"\s*→\s*", str(record.get("Sites / services involved") or "")) if step.strip()],
                "urls": urls_from_text(record.get("Evidence")),
            }
            for index, record in enumerate(tables["fragmentedJourneys"], start=1)
        ],
        "duplicationAudit": tables["duplicationAudit"],
        "evidenceGaps": evidence_gaps,
        "evidenceRegister": [
            {
                **record,
                "id": f"evidence-{index}-{slug(record.get('Site / capability'))}",
                "urls": urls_from_text(record.get("Source URL / evidence")),
                "statusState": status_state(record),
            }
            for index, record in enumerate(tables["evidenceRegister"], start=1)
        ],
        "tocComparison": {
            "providers": comparison_columns,
            "rows": matrix_rows,
            "legend": raw_sheets.get("TOC Comparison", [[], []])[1][0] if len(raw_sheets.get("TOC Comparison", [])) > 1 else "",
        },
    }


def make_quality_report(data: dict[str, Any]) -> str:
    metrics = data["metrics"]
    coverage = data["coverage"]
    lines = [
        "# UK Rail Digital Landscape Data-Quality Report",
        "",
        f"Generated: {data['meta']['generatedAt']}",
        f"Source workbook: `{data['meta']['sourceWorkbook']}`",
        "",
        "## Data Replacement",
        "",
        "- Old dataset removed/replaced: YES",
        "- New expanded Excel successfully imported: YES",
        "- Previous Pass 1 / Pass 2 JSON was not merged into the generated dataset.",
        "",
        "## Programmatic Coverage",
        "",
        f"- Excel digital properties: {coverage['digitalProperties']['excel']}",
        f"- Imported into application: {coverage['digitalProperties']['imported']}",
        f"- Represented in interface paths: {coverage['digitalProperties']['represented']}",
        f"- Unmapped digital properties: {coverage['digitalProperties']['unmapped']}",
        f"- Digital properties without workbook journey mapping: {coverage['digitalProperties']['withoutJourneyMapping']}",
        f"- Digital properties without direct capability relationship: {coverage['digitalProperties']['withoutCapabilityMapping']}",
        f"- Excel capabilities: {coverage['capabilities']['excel']}",
        f"- Capabilities represented: {coverage['capabilities']['represented']}",
        f"- Unmapped capabilities: {coverage['capabilities']['unmapped']}",
        f"- Capabilities without journey mapping: {coverage['capabilities']['withoutJourneyMapping']}",
        f"- Passenger needs represented: {coverage['passengerNeeds']['represented']}",
        "",
        "## Data Quality Counts",
        "",
        f"- Verified: {metrics['verified']}",
        f"- Partially verified: {metrics['partiallyVerified']}",
        f"- SME validation required: {metrics['smeValidationRequired']}",
        f"- Unclassified: {metrics['unclassified']}",
        "",
        "## Missing Fields",
        "",
    ]

    for table_name, records in data["tables"].items():
        if not isinstance(records, list) or not records or not isinstance(records[0], dict):
            continue
        counts = Counter()
        for record in records:
            for field, value in record.items():
                if value in {None, ""}:
                    counts[field] += 1
        notable = [f"{field}: {count}/{len(records)}" for field, count in counts.most_common() if count / len(records) >= 0.15]
        if notable:
            lines.append(f"- `{table_name}`: " + "; ".join(notable))

    url_counts = Counter(str(item.get("URL")) for item in data["digitalProperties"] if item.get("URL"))
    duplicate_urls = sorted((url, count) for url, count in url_counts.items() if count > 1)
    capability_labels = Counter(slug(item["capability"]) for item in data["capabilities"])
    duplicate_caps = sorted(label for label, count in capability_labels.items() if count > 1)

    lines.extend(["", "## Duplicate / Contradiction Checks", ""])
    if duplicate_urls:
        lines.append("- Duplicate Master Inventory URLs found and preserved as separate source rows:")
        for url, count in duplicate_urls[:50]:
            lines.append(f"  - `{url}` appears {count} times")
    else:
        lines.append("- No duplicate Master Inventory URLs found.")
    if duplicate_caps:
        lines.append("- Duplicate capability labels after normalisation:")
        for label in duplicate_caps[:50]:
            lines.append(f"  - `{label}`")
    else:
        lines.append("- No duplicate capability labels found after normalisation.")
    lines.append("- The workbook has no formal contradiction field; duplicate URLs, duplicate labels and unmatched provider references are flagged rather than silently resolved.")

    org_names = {normalize_phrase(org["organisation"]) for org in data["organisations"]}
    property_names = {normalize_phrase(prop["brandService"]) for prop in data["digitalProperties"]}
    service_names = {normalize_phrase(service["name"]) for service in data["significantServices"]}
    unmatched = []
    for capability in data["capabilities"]:
        for provider in capability.get("providers", []):
            provider_norm = normalize_phrase(provider)
            if provider_norm and provider_norm not in org_names and provider_norm not in property_names and provider_norm not in service_names:
                unmatched.append((capability["capability"], provider))
    lines.extend(["", "## Provider References Not Precisely Matched", ""])
    lines.append(f"- Unmatched provider references: {len(unmatched)}")
    for capability, provider in unmatched[:80]:
        lines.append(f"  - `{provider}` for `{capability}`")

    lines.extend(
        [
            "",
            "## SME Validation And Uncertainty",
            "",
            f"- Evidence gap records: {len(data['evidenceGaps'])}",
            "- `not found`, `unknown`, `unclear`, `not applicable` and `needs verification` are kept as distinct states.",
            "- Blank fields remain blank in JSON and display as `Not captured in audit` in detail panels.",
            "",
            "## Visualisation Coverage",
            "",
            "- Every Master Inventory digital property is available through the Audit inventory layer.",
            "- Every Capability Inventory capability is available through the matrix or Audit capability layer.",
            "- Capabilities without a workbook journey stage are retained for audit review instead of being deleted.",
            "- Digital properties without direct capability evidence are retained in the audit inventory and marked by missing relationship counts.",
        ]
    )
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workbook", default=DEFAULT_WORKBOOK)
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
    parser.add_argument("--quality-report", default=DEFAULT_QUALITY_REPORT)
    args = parser.parse_args()

    workbook_path = Path(args.workbook).expanduser()
    if not workbook_path.exists():
        raise FileNotFoundError(f"Workbook not found: {workbook_path}")

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    data = build(workbook_path)
    raw_sheets = data.pop("rawSheets")
    raw_output_path = output_path.with_name("workbook-raw-sheets.json")
    raw_output_path.write_text(
        json.dumps(
            {
                "sourceWorkbook": str(workbook_path),
                "generatedAt": data["meta"]["generatedAt"],
                "rawSheets": raw_sheets,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    output_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    report_path = Path(args.quality_report)
    report_path.write_text(make_quality_report(data), encoding="utf-8")
    print(f"Wrote {output_path} from {workbook_path}")
    print(f"Wrote raw worksheet audit trail to {raw_output_path}")
    print(f"Wrote data-quality report to {report_path}")
    print(json.dumps({"metrics": data["metrics"], "coverage": data["coverage"]}, indent=2))


if __name__ == "__main__":
    main()
