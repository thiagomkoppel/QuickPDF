import { createPortal } from "react-dom";
import { useEffect, useRef, type KeyboardEvent } from "react";

interface LeaveWithoutSavingDialogProps {
  readonly onStay: () => void;
  readonly onLeave: () => void;
}

export const LeaveWithoutSavingDialog = ({
  onStay,
  onLeave,
}: LeaveWithoutSavingDialogProps): React.ReactElement => {
  const stayButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    stayButtonRef.current?.focus();
    const closeOnEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onStay();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onStay]);

  const trapFocus = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const first = controls[0];
    const last = controls.at(-1);
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="export-dialog-backdrop leave-without-saving-backdrop">
      <section
        aria-describedby="leave-without-saving-description"
        aria-labelledby="leave-without-saving-title"
        aria-modal="true"
        className="export-dialog leave-without-saving-dialog"
        role="dialog"
        onKeyDown={trapFocus}
      >
        <header>
          <span
            aria-hidden="true"
            className="export-dialog__icon leave-without-saving-dialog__icon"
          >
            !
          </span>
          <div>
            <h2 id="leave-without-saving-title">Leave without saving?</h2>
            <p id="leave-without-saving-description">
              You have unsaved changes in this PDF. If you leave now, your edits will be lost.
            </p>
          </div>
        </header>
        <footer>
          <button ref={stayButtonRef} type="button" onClick={onStay}>
            Stay here
          </button>
          <button className="leave-without-saving-dialog__leave" type="button" onClick={onLeave}>
            Leave without saving
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
};
