# Attempt Sends After Usage Limit

This optional feature keeps **Send** available in a local Codex thread when
the signed-in ChatGPT account reports exhausted usage. The request still goes
through the normal Codex backend. It can succeed through a separately
authenticated proxy or return the backend's normal error.

The patch clears the usage-limit entry in the account usage module's shared
submit-blocked list for the local host, so every local surface that reads that
list stops treating exhausted usage as a block: both local thread composers and
two other submit and disabled-state checks. The account usage indicator and
banners still show the signed-in account's status. Other composer blocks, such as missing input, policy restrictions, and
an in-progress submission, continue to apply. Cloud tasks and ChatGPT
conversations keep their upstream behavior.

Enable the feature in the gitignored `linux-features/features.json`, then
rebuild the app/package:

```json
{
  "enabled": ["usage-limit-send-attempt"]
}
```

Run `node --test linux-features/usage-limit-send-attempt/test.js` to verify
the patch contract. An `install.sh --inspect` build verifies the current signed
official package.
