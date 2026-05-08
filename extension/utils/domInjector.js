export function injectValue(element, value) {

  const nativeSetter =
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set;

  nativeSetter.call(element, value);

  element.dispatchEvent(
    new Event("input", { bubbles: true })
  );

  element.dispatchEvent(
    new Event("change", { bubbles: true })
  );
}