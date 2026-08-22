# Security probe catalog

`attack-catalog.ts` selects 50 scenarios from the OWASP Web Security Testing Guide checklist and implements conservative source-evidence indicators for the TypeScript/React/Node demo stack.

- Source: [OWASP Web Security Testing Guide](https://github.com/OWASP/wstg)
- Scenario identifier format: `WSTG-<category>-<number>`
- OWASP WSTG content license: [CC BY-SA 4.0](https://github.com/OWASP/wstg/blob/master/LICENSE)

The probe implementation is a local static code-review aid. A match is evidence that an insecure construct deserves review; it is not proof that an exploit succeeded. The suite does not send network traffic or mutate the analyzed repository.
