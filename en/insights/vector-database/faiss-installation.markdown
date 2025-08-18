---
layout: insight
title: "Installing FAISS with pyenv and venv (CPU version on macOS)"
permalink: /en/insights/vector-database/faiss-installation/
categories: [AI, Vector Search]
tags: [faiss, python, pyenv, venv, installation]
excerpt: "A step-by-step guide to installing Facebook's FAISS library using pyenv and venv, ensuring a clean, isolated Python environment for vector similarity search on macOS."
date: 2025-04-24
author: "Arash Kashi"
---

# Installing FAISS with pyenv and venv (CPU version on macOS)

This guide walks you through installing Facebook's FAISS library using `pyenv` and `venv` for an isolated and version-controlled setup — without touching your global Python environment.

---

## Step 1: Install a Python Version Using `pyenv`

Install and activate a Python version (e.g., 3.11.8):

```bash
pyenv install 3.11.3
pyenv local 3.11.3
```

This creates a `.python-version` file and makes sure all future Python commands in this folder use the correct version.

---

## Step 2: Create a Virtual Environment

```bash
python -m venv .venv
source .venv/bin/activate
```

📝 **Note:** When activated, this `.venv` folder becomes the default location for all `pip install` commands.  
That means everything — including `faiss-cpu` — will be installed **locally inside `.venv/lib/python3.x/site-packages`**, **not globally**.

This protects your system Python and keeps all dependencies isolated to this project.

---

## Step 3: Upgrade pip and core tools

```bash
pip install --upgrade pip setuptools wheel
```

This ensures compatibility with most modern packages and builds.

---

## Step 4: Install FAISS (CPU version)

```bash
pip install faiss-cpu
```

📝 **Note:**  
As long as your virtual environment is activated (which it is if you see `(.venv)` in your terminal prompt), this will install **FAISS locally in your project’s `.venv` folder**.

You’re not affecting the system Python or any other projects.

---

## Step 5: Test the Installation

Create a file `faiss_test.py`:

```python
import faiss              # Import the FAISS library for similarity search
import numpy as np        # Import NumPy for creating and handling arrays

d = 64                    # Dimensionality of the vectors

# Generate a random database of 1000 vectors, each of dimension 64
# and convert them to float32 (FAISS expects float32, not float64)
xb = np.random.random((1000, d)).astype('float32')

# Generate 5 random query vectors of the same dimension
xq = np.random.random((5, d)).astype('float32')

# Create a FAISS index using L2 (Euclidean) distance
# This is a flat (brute-force) index — no compression or optimization
index = faiss.IndexFlatL2(d)

# Add the database vectors to the index
index.add(xb)

# Search the index for the 5 nearest neighbours of each query vector
# Returns distances (D) and indices (I) of the nearest neighbours
D, I = index.search(xq, 5)

# Print the indices of the 5 nearest neighbours for each query
print("Indices:", I)
```

Run it:

```bash
python faiss_test.py
```

If you see a list of index results without errors, FAISS is working!

---

## Optional: Deactivate the Environment

```bash
deactivate
```

You can reactivate later with:

```bash
source .venv/bin/activate
```

---

With this setup, your FAISS installation is isolated, reproducible, and does not pollute your global Python environment.
