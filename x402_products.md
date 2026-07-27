# x402 Product List + Kill-Test Methodology
# Orders of Magnitude / Lumière
# ~100 endpoints across 9 categories

---

## RULE: Data wrappers = build directly. NS computation = kill-test first. AI-enriched = cost-check first.

---

## CAT 1 — DATA GLOBAL (30 endpoints) | $0.01/call | No kill-test needed
Build order: template first, then copy-paste per source.

1.  Crypto prices (CoinGecko)
2.  Crypto market cap + dominance (CoinGecko)
3.  Crypto funding rates (Binance/Bybit/OKX)
4.  DeFi TVL by protocol (DeFiLlama)
5.  Macro indicators — US (FRED)
6.  Macro indicators — global (World Bank API)
7.  Bond yields + yield curve (FRED)
8.  Commodity prices (FRED/Quandl)
9.  Exchange rates multi-source (ECB + FRED aggregated)
10. Stock market data (Yahoo Finance)
11. SEC EDGAR filings lookup
12. Company registry (OpenCorporates)
13. Sanctions screening (OFAC free list)
14. Patent search (USPTO API)
15. Scientific literature (arXiv API)
16. Clinical trials lookup (ClinicalTrials.gov)
17. Drug adverse events (OpenFDA)
18. FDA recalls (OpenFDA)
19. CVE vulnerability lookup (NVD)
20. Earthquake/seismic data (USGS)
21. Air quality index (OpenAQ)
22. Weather extremes (NOAA)
23. Job market data (BLS)
24. Academic citation graph (OpenCitations)
25. Nutrition database (USDA FoodData)
26. Domain WHOIS + DNS
27. IP geolocation (ip-api free tier)
28. Email validation (syntax + MX)
29. Economic indicators (OECD)
30. Port/shipping AIS data (MarineTraffic free)

---

## CAT 2 — DATA REGIONAL MY/PK (12 endpoints) | $0.01-0.02/call | No kill-test needed
Unique: zero competitors in this geography on x402.

31. Bursa Malaysia stock prices (Bursa API / scrape)
32. BNM exchange rates (BNM API — free, official)
33. Malaysia economic indicators (Dosm.gov.my)
34. Malaysia property transactions (Napic API)
35. SSM company lookup (where accessible)
36. Malaysia news — English (RSS aggregation)
37. Malaysia news — Bahasa (RSS aggregation)
38. PSX Pakistan stock prices
39. SBP exchange rates (SBP API — free, official)
40. Pakistan economic data (PBS.gov.pk)
41. SECP company registry (where accessible)
42. Pakistan news aggregation

---

## CAT 3 — DATA REGIONAL SEA/MENA/OTHER (18 endpoints) | $0.01/call | No kill-test needed
AI agents searching regionally will auto-discover these. No human competition here yet.

43. SGX Singapore equities
44. IDX Indonesia equities
45. SET Thailand equities
46. PSE Philippines equities
47. Saudi Tadawul (Argaam API / scrape)
48. UAE ADX data
49. Egypt EGX data
50. Nigeria NGX data
51. Kenya NSE data
52. Turkey BIST data
53. India NSE/BSE (Yahoo Finance)
54. Brazil BOVESPA
55. South Africa JSE
56. Mexico BMV
57. Gulf macro indicators (GCC Stat)
58. MENA news aggregation (English)
59. ASEAN economic indicators (ASEAN Stats)
60. Africa macro indicators (World Bank filtered)

---

## CAT 4 — AI-ENRICHED PREMIUM | $0.25-1.00/call | Cost-check before build

KILL-TEST (10 min): Pick one endpoint. Estimate avg tokens in + out.
Math: ($10 × input_MTok) + ($50 × output_MTok) = cost/call.
Confirm margin at target price. If margin <60%, reprice or drop.
Fable 5 backend. Position as "Mythos-class inference."

61. Contract risk analysis (PDF in → risk score + flags out)
62. Earnings call intelligence (transcript in → signals out)
63. Market pattern analysis (OHLCV in → regime + signal out)
64. Company research brief (ticker in → structured brief out)
65. Regulatory risk score (filing in → risk out)
66. Competitive intelligence synthesis
67. Due diligence summary (document in → structured out)
68. Supply chain risk assessment
69. Patent claim analysis (patent in → prior art flags out)
70. M&A signal detection (filing in → signals out)

---

## CAT 5 — AI-ENRICHED LITE | $0.02-0.05/call | Cost-check before build

KILL-TEST (5 min): Same as Cat 4 but Haiku backend.
Haiku cost: $0.80/MTok in, $4/MTok out. Margins much easier.

71. News synthesis (headlines in → brief out)
72. Sentiment analysis (text in → score + reasoning out)
73. Financial ratio interpretation (numbers in → plain English out)
74. Job description analysis (JD in → skills/salary signals out)
75. Product review synthesis (reviews in → verdict out)
76. Regulatory filing summary (filing in → summary out)
77. Clinical abstract summary (abstract in → key findings out)
78. Email tone analysis
79. Social post sentiment batch
80. Company description standardizer

---

## CAT 6 — NS COMPUTATION (10 endpoints) | $0.05-0.25/call | KILL-TEST REQUIRED

KILL-TEST METHODOLOGY (run before building any of these):
Goal: confirm compute time dominates transfer time at viable input sizes.
Test: mock endpoint (no x402 yet), measure round-trip at 1MB / 10MB / 100MB.
Pass criteria: compute saves ≥ 2x the transfer cost at ≥ 10MB inputs.
If fail: endpoint is physics-blocked. Drop it. Don't build.
Run this ONCE per product type. Results generalize across variants.

81. NSComp decompress — LIKELY PASS (small in, large out, transfer favors you)
82. NSComp compress — TEST (large in, small out — transfer cost is the risk)
83. NSFix single message parse — LIKELY PASS (tiny inputs, high per-message value)
84. NSFix batch parse — LIKELY PASS (structured, small messages)
85. NSFix validate — LIKELY PASS
86. NSSort dataset sort — TEST (large in+out — most physics risk here)
87. NSHash batch dedup — TEST (large in, smaller out)
88. NSHash stream dedup — TEST
89. NSIndex build — TEST (dataset in, index out)
90. NSIndex query — LIKELY PASS (tiny query in, result out — index stays server-side)

NOTE: NSIndex query is the strongest NS endpoint if index stays server-side.
Agent submits dataset once to build index ($0.25), then queries forever ($0.01/query).
Recurring revenue model within a single product.

---

## CAT 7 — NS SPECIALTY VARIANTS (5 endpoints) | $0.05-0.10/call
Build after Cat 6 kill-tests confirm viable products.

91. NSComp streaming (chunked compression for large files)
92. NSSort with schema detection (auto-detect data structure, pick optimal path)
93. NSHash with similarity scoring (fuzzy dedup, not just exact)
94. NSIndex multi-key (compound index queries)
95. NSFix session-aware (stateful FIX session handling)

---

## CAT 8 — NSBVH (5 endpoints) | $0.10-0.50/call | BUILD AFTER SEAL
Do not build until NSBVH is sealed. Block is real.

96. NSBVH scene query
97. NSBVH ray cast
98. NSBVH collision detect
99. NSBVH broadphase
100. NSBVH spatial index

---

## INDEXING CHECKLIST (one-time, all 100 endpoints simultaneously)
- [ ] /.well-known/x402.json manifest (Devin generates from product list)
- [ ] /openapi.json spec (auto-generated)
- [ ] /llms.txt (plain English summary of all endpoints)
- [ ] Register: x402scan Bazaar
- [ ] Register: x402search MCP (14K+ APIs indexed)
- [ ] Register: EntRoute (quality-ranked discovery)
- [ ] Register: ERC-8004 on-chain registry
- [ ] HN post on launch day

---

## BUILD SEQUENCE
1. Template server (Express + x402 middleware + Base wallet + Railway) — 1 Devin session
2. Cat 1 data global (30 endpoints) — 1-2 sessions
3. Cat 2+3 regional data (30 endpoints) — 1-2 sessions
4. NS kill-tests (manual, 2 hours, you review results before proceeding)
5. Cat 6 NS endpoints that pass kill-test — 1 session
6. Cat 4+5 AI-enriched (cost-check, then build) — 1 session
7. Indexing + HN post — 1 session
8. Cat 7+8 after respective gates clear

Total Devin sessions: 7-9
Your active time: ~15 hours across 3-4 weeks
