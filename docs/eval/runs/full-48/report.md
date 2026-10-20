# Scene eval — 2026-10-19T10-14-03

16/48 valid · 15 on the first try · avg 38.5s · 0 with layout overlaps · model gemini-3.6-flash

| id | domain | ok | attempts | s | beats | overlaps | warnings | title / error |
|---|---|---|---|---|---|---|---|---|
| alg-1 | algorithms | ✓ | 1 | 31.6 | 4 | 0 | 0 | Bubble Sort on [5, 1, 4, 2, 8] |
| alg-2 | algorithms | ✓ | 1 | 16.7 | 4 | 0 | 0 | Binary Search for 23 |
| alg-3 | algorithms | ✓ | 1 | 18.6 | 5 | 0 | 1 | Merge Sort on [38, 27, 43, 3, 9, 82, 10] |
| alg-4 | algorithms | ✓ | 1 | 19.1 | 5 | 0 | 0 | Quicksort Lomuto Partitioning |
| alg-5 | algorithms | ✓ | 1 | 26.9 | 5 | 0 | 0 | BFS Exploration of a Simple Graph |
| alg-6 | algorithms | ✓ | 1 | 43.4 | 6 | 0 | 0 | Dijkstra's shortest‑path walk‑through |
| ds-1 | data-structures | ✓ | 1 | 50.2 | 5 | 0 | 0 | Stack vs Queue |
| ds-2 | data-structures | ✓ | 1 | 37.7 | 4 | 0 | 0 | Insert at Head of Linked List |
| ds-3 | data-structures | ✓ | 1 | 50.6 | 6 | 0 | 1 | Building a BST by inserting values |
| ds-4 | data-structures | ✗ | 0 | 60.4 | 0 | 0 | 0 | 413 Request too large for model `openai/gpt-oss-120b` in organization `org_01m2zxhxe5e0g92z02636rb5z3` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 8341, please reduce your message size and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing |
| ds-5 | data-structures | ✓ | 1 | 10.3 | 4 | 0 | 0 | Insert 3 into a min‑heap |
| ds-6 | data-structures | ✓ | 1 | 42.9 | 5 | 0 | 0 | LRU Cache Eviction Explained |
| math-1 | math | ✓ | 1 | 27.9 | 4 | 0 | 0 | Solving 2x + 3 = 11 |
| math-2 | math | ✓ | 1 | 55.4 | 4 | 0 | 0 | Roots of x² − 4x + 3 |
| math-3 | math | ✗ | 0 | 17.2 | 0 | 0 | 0 | 413 Request too large for model `openai/gpt-oss-120b` in organization `org_01m2zxhxe5e0g92z02636rb5z3` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 8824, please reduce your message size and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing |
| math-4 | math | ✓ | 1 | 47.5 | 5 | 0 | 1 | Area under y = x from 0 to 2 |
| math-5 | math | ✓ | 1 | 42.9 | 4 | 0 | 0 | Understanding 3/4 of a pizza |
| math-6 | math | ✓ | 2 | 93.6 | 6 | 0 | 2 | 2×2 Matrix Multiplication |
| geo-1 | geometry | ✗ | 0 | 5.5 | 0 | 0 | 0 | 429 Rate limit reached for model `openai/gpt-oss-120b` in organization `org_01m2zxhxe5e0g92z02636rb5z3` service tier `on_demand` on tokens per day (TPD): Limit 200000, Used 198069, Requested 6491. Please try again in 32m49.92s. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing |
| geo-2 | geometry | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| geo-3 | geometry | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| geo-4 | geometry | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| geo-5 | geometry | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| geo-6 | geometry | ✗ | 0 | 0 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| phy-1 | physics | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| phy-2 | physics | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| phy-3 | physics | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| phy-4 | physics | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| phy-5 | physics | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| phy-6 | physics | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| chem-1 | chemistry | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| chem-2 | chemistry | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| chem-3 | chemistry | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| chem-4 | chemistry | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| chem-5 | chemistry | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| chem-6 | chemistry | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| bio-1 | biology | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| bio-2 | biology | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| bio-3 | biology | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| bio-4 | biology | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| bio-5 | biology | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| bio-6 | biology | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| ml-1 | ml | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| ml-2 | ml | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| ml-3 | ml | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| ml-4 | ml | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| ml-5 | ml | ✗ | 0 | 0.1 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |
| ml-6 | ml | ✗ | 0 | 0.2 | 0 | 0 | 0 | CIRCUIT_OPEN: groq is currently unavailable. |