export function detectFields() {

  const inputs = document.querySelectorAll(
    "input, textarea, select"
  );

  return [...inputs].map(input => ({
    label:
      input.labels?.[0]?.innerText || "",

    name: input.name || "",

    placeholder: input.placeholder || "",

    type: input.type || "text"
  }));
}