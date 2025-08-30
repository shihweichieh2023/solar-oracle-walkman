
# FakeChain IV Test Server (macOS friendly)

This is a **zero‑blockchain** local server to prototype your IV "upload & verify" flow from Max/MSP.
It mimics "on‑chain success" by writing each submission into an **append‑only hash chain** (each block
hashes the previous one). You get a `tx_id` back immediately, and you can later query or verify the chain.

## Endpoints

- `POST /api/iv` → body: `{"identity": "...", "public_key": "...", "iv7": [7 floats]}`
  - returns: `{"ok": true, "tx_id": "...", "height": 1, "block_hash": "...", "iv_hash": "..."}`
- `GET /api/tx/<tx_id>` → fetch one record
- `GET /api/verify` → recompute hashes and confirm the chain is intact

## Quick start (first time)

```bash
cd "/mnt/data/iv_fakechain_server"
/usr/bin/python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

The server listens on `http://127.0.0.1:5000/`.

## Test with curl

```bash
curl -X POST http://127.0.0.1:5000/api/iv   -H "Content-Type: application/json"   -d '{"identity":"wei","public_key":"pk_demo","iv7":[0.36,0.54,0.66,0.51,1.36,0.086,0.63]}'
```

## Use from Max/MSP with [maxurl]

1) Create a dictionary and fill it:

```
----------begin max5_patcher----------
1112.3ocwTtbahCD8Y8Ycch6BZ0n0m0vBqEwWJX8wX1ZtY3nLwJb7lqkG+7p
... (intentionally omitted; see instructions below) ...
----------end max5_patcher------------
```

(Skip the long pastedbox: it's easier to build by hand.)

- [dict iv]
- messages:
  - `set identity wei`
  - `set public_key pk_demo`
  - `set iv7 0.36 0.54 0.66 0.51 1.36 0.086 0.63`

2) Connect `[dict iv]` → message `post iv` → `[maxurl http://127.0.0.1:5000/api/iv @method post @type json]`

3) Use `[route ok tx_id height block_hash iv_hash error]` on the left outlet of `maxurl` to parse the JSON response.

4) To verify later, call: `[maxurl http://127.0.0.1:5000/api/verify]`

## Notes

- This is NOT a blockchain; it's a **tamper-evident log** good enough for rapid prototyping your oracle flow.
- Later you can swap it for a real chain (Hardhat + Solidity) without changing the Max payload.
- The database file is `fakechain.db`. Delete it to reset.
