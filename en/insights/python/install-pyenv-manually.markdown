---
layout: insight
title: "Manual Installation of pyenv Without Package Managers"
permalink: /en/insights/python/manual-pyenv-install/
categories: [Development, Python]
tags: [pyenv, python, environment, shell]
excerpt: "A step-by-step guide to installing pyenv manually, configuring your shell, and automating the setup with a custom script."
date: 2025-04-24
author: "Arash Kashi"
---

# Manual Installation of `pyenv` Without Package Managers

This guide walks you through installing `pyenv` manually (without Homebrew or other package managers), setting it up in your shell, and verifying the installation. At the end, you'll find a full automation script.

---

## Step 1: Clone the `pyenv` Repository

Clone `pyenv` into your home directory:

```bash
git clone https://github.com/pyenv/pyenv.git ~/.pyenv
```

---

## 🛠️ Step 2: Configure Your Shell

Add the following to your `~/.zprofile` (for environment setup):

```bash
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init --path)"
```

And this to your `~/.zshrc` (for interactive shell features):

```bash
eval "$(pyenv init -)"
```

Then reload both files:

```bash
source ~/.zprofile
source ~/.zshrc
```

The exact setup depends on your shell and which files it loads.  
🔎 If you're unsure about the difference between `.zshrc`, `.zprofile`, `.bashrc`, and `.bash_profile`, check out this guide:  
👉 [Understanding .zshrc vs .zprofile](/en/insights/shell/zshrc-vs-zprofile/)
👉 [Understanding login shell](/en/insights/shell/login-shell-explained/)

---

## ✅ Step 3: Verify the Installation

Check that `pyenv` is working:

```bash
pyenv --version
```

You should see something like:

```
pyenv 2.x.x
```

---

## 🔧 Step 4: Install Build Dependencies (Optional)

Python builds require developer tools. Start by installing Xcode CLI tools:

```bash
xcode-select --install
```

If you run into issues installing Python versions, you may need to install the following libraries manually:
- `zlib`
- `bzip2`
- `xz`
- `libffi`
- `openssl`
- `sqlite`
- `readline`

---

## 🤖 Full Automation Script

You can automate all of the above with the following shell script. Save it as `install_pyenv.sh`:

```bash
#!/bin/bash

echo "🔧 Cloning pyenv..."
git clone https://github.com/pyenv/pyenv.git ~/.pyenv

echo "🧠 Detecting shell..."
SHELL_CONFIG=""
if [[ $SHELL == *"zsh" ]]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [[ $SHELL == *"bash" ]]; then
    SHELL_CONFIG="$HOME/.bashrc"
else
    echo "❌ Unsupported shell. Please edit your shell config manually."
    exit 1
fi

echo "🔧 Updating $SHELL_CONFIG..."
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> "$SHELL_CONFIG"
echo 'export PATH="$PYENV_ROOT/bin:$PATH"' >> "$SHELL_CONFIG"
echo 'eval "$(pyenv init --path)"' >> "$SHELL_CONFIG"
echo 'eval "$(pyenv init -)"' >> "$SHELL_CONFIG"

echo "✅ pyenv installed. Please restart your terminal or run:"
echo "   source $SHELL_CONFIG"
```

Make it executable and run it:

```bash
chmod +x install_pyenv.sh
./install_pyenv.sh
```

---

## 🎉 Done!

You now have `pyenv` installed manually without relying on Homebrew or other package managers. You can now:

```bash
pyenv install 3.11.8
pyenv local 3.11.8
```

And combine it with:

```bash
python -m venv .venv
source .venv/bin/activate
```

To create a fully isolated, version-controlled Python development environment.

Let me know if you'd like to continue with installing FAISS next.
