export interface BeforeUnloadWarning {
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

export class BrowserBeforeUnloadWarning implements BeforeUnloadWarning {
  #enabled = false;

  readonly #handler = (event: BeforeUnloadEvent): void => {
    if (!this.#enabled) {
      return;
    }
    event.preventDefault();
    // Required by browsers that still gate beforeunload prompts on returnValue.\n    // eslint-disable-next-line @typescript-eslint/no-deprecated\n    event.returnValue = "";
  };

  public constructor() {
    window.addEventListener("beforeunload", this.#handler);
  }

  public setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
  }

  public dispose(): void {
    window.removeEventListener("beforeunload", this.#handler);
    this.#enabled = false;
  }
}
