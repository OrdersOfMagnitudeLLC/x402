#!/usr/bin/env python3
"""
OpenRouter API Virality Pricing Test
Tests models on pricing strategy and virality ideas.
"""

import os
import requests
from datetime import datetime
from typing import Dict, List

# Configuration
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
OUTPUT_FILE = "/home/lumiere/pricing_test/virality_results.txt"

MODELS = [
    "openai/gpt-4o",
    "google/gemini-2.5-pro",
    "deepseek/deepseek-chat",
    "mistralai/mistral-large",
    "meta-llama/llama-3.3-70b-instruct",
    "anthropic/claude-sonnet-4-5"
]

SYSTEM_PROMPT = "You are a strategic pricing and growth consultant for high-performance C++ infrastructure products. You specialize in viral go-to-market strategies for developer tools."

USER_PROMPT = """I have a C++ library suite with extraordinary performance claims:
- NSHash — 55x faster than Google absl on structured keys
- NSFix — 25x faster than QuickFIX, zero heap allocation
- NSQueue — 4.2x rigtorp SPSCQueue, 400M items/sec
- NSAlloc — 2.53x mimalloc on bulk reset
- NSLock — 2.83x std::shared_mutex at 256 threads
- NSIndex — 7.5x PGM-Index on hits, 21x std::lower_bound
- NSComp — 7.54x compression ratio, 30x faster decompress than zstd
- NSSort — 18.4x IPS4o on 1B duplicate elements
- NSBVH — 2.45x Intel Embree on sparse scenes
- NSMatrix — 2.49x Eigen on block-diagonal sparse matrices
- NSCache — 5.67x LRU on random workloads at 131K entries
- NSOptimize — 387x faster than 2-opt TSP, under 3.5% quality gap

Each is a drop-in header-only library. AGPL licensed — customers must open-source their product or buy a commercial license.

Current pricing idea: Price drops 10% every year a customer stays, until it reaches zero.

Question 1: Is this declining pricing strategy good or bad? Explain why, considering developer psychology, revenue sustainability, and competitive positioning.

Question 2: What's an EVEN MORE INSANE pricing or go-to-market strategy that could create viral growth? Think outside the box - unconventional, bold, potentially controversial ideas that would get people talking and drive rapid adoption. Be creative."""


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


def run_tests() -> List[Dict]:
    """Run all tests and return results."""
    results = []
    
    print(f"Starting virality test at {datetime.now()}")
    print(f"Testing {len(MODELS)} models...")
    
    for i, model in enumerate(MODELS, 1):
        print(f"\n[{i}/{len(MODELS)}] Testing {model}...")
        response = call_openrouter(model, SYSTEM_PROMPT, USER_PROMPT)
        results.append({
            "model": model,
            "response": response
        })
    
    return results


def write_results(results: List[Dict]):
    """Write all results to output file."""
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    with open(OUTPUT_FILE, "w") as f:
        f.write(f"OpenRouter API Virality Pricing Test Results\n")
        f.write(f"Generated: {datetime.now()}\n")
        f.write(f"Total models tested: {len(MODELS)}\n")
        f.write("="*80 + "\n\n")
        
        for result in results:
            f.write(f"Model: {result['model']}\n")
            f.write(f"Response:\n{result['response']}\n")
            f.write("="*80 + "\n\n")
    
    print(f"\nResults written to {OUTPUT_FILE}")


def main():
    """Main entry point."""
    if not OPENROUTER_API_KEY:
        print("ERROR: OPENROUTER_API_KEY environment variable not set")
        return
    
    print("OpenRouter API Virality Pricing Test")
    print("="*80)
    
    results = run_tests()
    write_results(results)
    
    print("\nTest complete!")


if __name__ == "__main__":
    main()
