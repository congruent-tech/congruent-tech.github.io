---
layout: insight
title: "What Is a Login Shell? Understand Shell Startup on Terminal.app"
permalink: /en/insights/shell/login-shell-explained/
categories: [Development, Shell]
tags: [zsh, shell, terminal, login-shell, configuration]
excerpt: "Learn what a login shell is, how it affects which shell config files run, and why it matters for tools like pyenv. Includes real Terminal.app examples."
date: 2025-04-24
author: "Arash Kashi"
---

# What Is a Login Shell? (With Examples)

Understanding the difference between login and non-login shells is essential when configuring your shell environment correctly — especially for tools like `pyenv`.

---

## Definition

A **login shell** is a shell session that acts as if you just logged into the system. It reads specific config files like `.zprofile` or `.bash_profile`, which are used to set environment variables and paths.

---

## Examples of Login Shells

### 1. **Opening Terminal.app (first window)**  
- Treated as a **login + interactive shell**
- Loads: `.zprofile` and `.zshrc`

### 2. **SSH into a remote server**
```bash
ssh user@host
```
- Loads: `.zprofile` (Zsh) or `.bash_profile` (Bash)
- Useful for setting up your environment remotely

### 3. **Explicit login shell using `zsh -l`**
```bash
zsh -l
```
- Loads: `.zprofile` only
- Good for testing login shell behavior

---

## Not Login Shells

### 1. **Run `zsh` without `-l`**
```bash
zsh
```
- This is an **interactive**, but **not a login**, shell
- Loads: `.zshrc` only

### 2. **Running a shell script**
```bash
./myscript.sh
```
- May invoke a **non-login, non-interactive** shell
- Doesn't load `.zprofile` or `.zshrc`

---

## Summary Table

| Action                         | Login Shell? | Loads `.zprofile` | Loads `.zshrc` |
|-------------------------------|--------------|-------------------|----------------|
| Open Terminal.app (first time)| ✅ Yes       | ✅                | ✅             |
| SSH into server               | ✅ Yes       | ✅                | ❌             |
| Run `zsh`                     | ❌ No        | ❌                | ✅             |
| Run `zsh -l`                  | ✅ Yes       | ✅                | ❌             |

---

# But! Why Do People Say `.zshrc` Doesn’t Run During SSH?

This is a common source of confusion when working with remote servers via SSH.

---

## Typical SSH Session

When you run:

```bash
ssh user@host
```

You get:
- A **login shell** ✅
- An **interactive shell** ✅

**Result:**  
Both `.zprofile` and `.zshrc` are executed.

---

## When `.zshrc` Does Not Run

When you run a **remote command** with SSH, like:

```bash
ssh user@host "echo $PATH"
```

You get:
- A **login shell** ✅
- But **not** an **interactive shell** ❌

**Result:**  
- `.zprofile` runs ✅  
- `.zshrc` does **not** run ❌

---

## Summary Table

| Command                         | Login Shell | Interactive Shell | `.zprofile` | `.zshrc` |
|----------------------------------|-------------|--------------------|-------------|----------|
| `ssh user@host`                  | ✅          | ✅                 | ✅          | ✅       |
| `ssh user@host "echo $PATH"`     | ✅          | ❌                 | ✅          | ❌       |
| `ssh -t user@host "zsh -i"`      | ✅          | ✅ (forced)        | ✅          | ✅       |

---

✅ So yes — in a **typical SSH terminal session**, `.zshrc` **does run**.  
❌ But in **SSH remote command execution**, it **does not**.

Keep your environment setup in `.zprofile`, and reserve `.zshrc` for interactive-only configs like aliases and prompts.


## Best Practice

- Put **environment setup** (like `PYENV_ROOT`, `PATH`) in `.zprofile`
- Put **interactive features** (like aliases, shell prompts) in `.zshrc`

This ensures consistent behavior across all terminal types and scripts.
