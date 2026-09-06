import type { EditorError, SignatureImageInput } from "./editor-application";
import type { SignatureBackgroundRemovalStatus } from "./signature-background-removal";

/**
 * Outcome of separating a signature from the paper behind it.
 *
 * `unchanged` means the image was kept as it was uploaded because no background could be told
 * apart from the ink; `failed` carries a typed error so the caller can keep the original image
 * and explain why the automatic removal did not run.
 */
export type SignatureBackgroundRemovalOutcome =
  | {
      readonly status: SignatureBackgroundRemovalStatus;
      readonly image: SignatureImageInput;
    }
  | {
      readonly status: "failed";
      readonly error: EditorError;
    };

/** Port for turning an uploaded signature photo into ink on a transparent background. */
export interface SignatureBackgroundRemover {
  remove(image: SignatureImageInput): Promise<SignatureBackgroundRemovalOutcome>;
}
