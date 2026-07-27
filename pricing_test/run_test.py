#!/usr/bin/env python3
"""
OpenRouter API Pricing Test Script
Tests multiple models with headliner and pricing scenarios.
"""

import os
import requests
import json
from datetime import datetime
from typing import Dict, List, Tuple

# Configuration
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
OUTPUT_FILE = "/home/lumiere/pricing_test/results.txt"

MODELS = [
    "openai/gpt-4o",
    "google/gemini-2.5-pro",
    "deepseek/deepseek-chat",
    "mistralai/mistral-large",
    "meta-llama/llama-3.3-70b-instruct",
    "qwen/qwen-2.5-72b-instruct",
    "anthropic/claude-sonnet-4-5"
]

# Prompts
HEADLINER_SYSTEM = "You are a senior C++ engineer evaluating performance libraries."

HEADLINER_USER = """Below are 12 real benchmark claims from a C++ library suite.
Which ONE headline would make you most excited to read the full
technical writeup? Just name the product and one sentence why.

1. NSHash — 55x faster than Google absl on structured keys
2. NSFix — 25x faster than QuickFIX, zero heap allocation
3. NSQueue — 4.2x rigtorp SPSCQueue, 400M items/sec
4. NSAlloc — 2.53x mimalloc on bulk reset
5. NSLock — 2.83x std::shared_mutex at 256 threads
6. NSIndex — 7.5x PGM-Index on hits, 21x std::lower_bound
7. NSComp — 7.54x compression ratio, 30x faster decompress than zstd
8. NSSort — 18.4x IPS4o on 1B duplicate elements
9. NSBVH — 2.45x Intel Embree on sparse scenes
10. NSMatrix — 2.49x Eigen on block-diagonal sparse matrices
11. NSCache — 5.67x LRU on random workloads at 131K entries
12. NSOptimize — 387x faster than 2-opt TSP, under 3.5% quality gap"""

PRICING_SYSTEMS = [
    "You are the CTO of a $3M/yr revenue software company that ships closed-source C++ products.",
    "You are VP Engineering at a $40M/yr revenue company with a large C++ backend team.",
    "You are Head of Engineering at NVIDIA, $60B revenue, heavy C++ infrastructure."
]

PRICING_USER = """You've found a C++ library suite. Individual products include:
- NSHash (55x faster than absl on structured keys)
- NSFix (25x faster than QuickFIX, zero heap)
- NSSort (18.4x faster than IPS4o on 1B duplicates)
- NSCache (5.67x faster than LRU at production scale)
- NSOptimize (387x faster than 2-opt TSP routing)

Each is a drop-in header-only library. AGPL licensed — you must
open-source your product or buy a commercial license.

Question 1: How much would you pay per year to license ONE of
these products commercially? Give a specific dollar amount.
Question 2: Would you pay more for a bundle of all 12 products?
If yes, how much more (as a multiple of single-product price)?
Question 3: If the price dropped 10% every year you stayed a
customer until it reached zero, would that make you MORE or LESS
likely to buy? One word answer then one sentence."""


def call_openrouter(model: str, system: str, user: str) -> str:
    """Make a single API call to OpenRouter."""
    if not OPENROUTER_API_KEY:
        return "ERROR: OPENROUTER_API_KEY not set"
    
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ]
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=120)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        return f"ERROR: {str(e)}"


def run_tests() -> Tuple[List[Dict], List[Dict]]:
    """Run all tests and return results."""
    headliner_results = []
    pricing_results = []
    
    print(f"Starting tests at {datetime.now()}")
    print(f"Testing {len(MODELS)} models...")
    
    for i, model in enumerate(MODELS, 1):
        print(f"\n[{i}/{len(MODELS)}] Testing {model}...")
        
        # Headliner test
        print(f"  - Running headliner test...")
        headliner_response = call_openrouter(model, HEADLINER_SYSTEM, HEADLINER_USER)
        headliner_results.append({
            "model": model,
            "response": headliner_response
        })
        
        # Pricing tests (3 different system prompts)
        for j, system in enumerate(PRICING_SYSTEMS, 1):
            print(f"  - Running pricing test {j}/3...")
            pricing_response = call_openrouter(model, system, PRICING_USER)
            pricing_results.append({
                "model": model,
                "system_variant": j,
                "system": system,
                "response": pricing_response
            })
    
    return headliner_results, pricing_results


def generate_summary(headliner_results: List[Dict], pricing_results: List[Dict]) -> str:
    """Generate summary of results."""
    summary = "\n" + "="*80 + "\n"
    summary += "SUMMARY\n"
    summary += "="*80 + "\n\n"
    
    # Headliner vote tally
    summary += "HEADLINER VOTE TALLY:\n"
    summary += "-"*80 + "\n"
    for result in headliner_results:
        summary += f"{result['model']}: {result['response'][:100]}...\n"
    summary += "\n"
    
    # Pricing by company size
    summary += "PRICING RESPONSES BY COMPANY SIZE:\n"
    summary += "-"*80 + "\n"
    company_sizes = ["$3M/yr (CTO)", "$40M/yr (VP Eng)", "$60B (NVIDIA Head of Eng)"]
    for i, size in enumerate(company_sizes, 1):
        summary += f"\n{size}:\n"
        for result in pricing_results:
            if result["system_variant"] == i:
                summary += f"  {result['model']}: {result['response'][:150]}...\n"
    
    # Bundle multiple consensus
    summary += "\n\nBUNDLE MULTIPLE CONSENSUS:\n"
    summary += "-"*80 + "\n"
    for result in pricing_results:
        summary += f"{result['model']} (variant {result['system_variant']}): {result['response'][:150]}...\n"
    
    return summary


def write_results(headliner_results: List[Dict], pricing_results: List[Dict]):
    """Write all results to output file."""
    # Ensure output directory exists
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    with open(OUTPUT_FILE, "w") as f:
        f.write(f"OpenRouter API Pricing Test Results\n")
        f.write(f"Generated: {datetime.now()}\n")
        f.write(f"Total models tested: {len(MODELS)}\n")
        f.write(f"Total API calls: {len(headliner_results) + len(pricing_results)}\n")
        f.write("="*80 + "\n\n")
        
        # Headliner results
        f.write("HEADLINER TEST RESULTS\n")
        f.write("="*80 + "\n\n")
        for result in headliner_results:
            f.write(f"Model: {result['model']}\n")
            f.write(f"Response:\n{result['response']}\n")
            f.write("-"*80 + "\n\n")
        
        # Pricing results
        f.write("\nPRICING TEST RESULTS\n")
        f.write("="*80 + "\n\n")
        for result in pricing_results:
            f.write(f"Model: {result['model']}\n")
            f.write(f"System Variant: {result['system_variant']}\n")
            f.write(f"System: {result['system']}\n")
            f.write(f"Response:\n{result['response']}\n")
            f.write("-"*80 + "\n\n")
        
        # Summary
        summary = generate_summary(headliner_results, pricing_results)
        f.write(summary)
    
    print(f"\nResults written to {OUTPUT_FILE}")


def main():
    """Main entry point."""
    if not OPENROUTER_API_KEY:
        print("ERROR: OPENROUTER_API_KEY environment variable not set")
        return
    
    print("OpenRouter API Pricing Test")
    print("="*80)
    
    headliner_results, pricing_results = run_tests()
    write_results(headliner_results, pricing_results)
    
    print("\nTest complete!")


if __name__ == "__main__":
    main()
