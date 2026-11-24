name: Something is wrong
description: A number, page or run that does not look right.
labels: [bug]
body:
  - type: textarea
    id: what
    attributes: { label: What happened, description: What was shown, and what was expected instead. }
    validations: { required: true }
  - type: input
    id: run
    attributes: { label: Run number, description: "Shown at the top of the home page (optional)." }
  - type: input
    id: where
    attributes: { label: Page and browser, placeholder: "/verify on iPhone Safari" }
  - type: checkboxes
    id: safe
    attributes:
      label: Before posting
      options:
        - { label: This does not contain a private key, seed phrase or personal details., required: true }
