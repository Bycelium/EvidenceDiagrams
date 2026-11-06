export type DialogSubmit = () => boolean;

type FormDialogOptions = {
  readonly dialog: HTMLDialogElement;
  readonly form: HTMLFormElement;
  readonly title: HTMLElement;
  readonly body: HTMLElement;
  readonly submitButton: HTMLButtonElement;
  readonly cancelButtons: readonly HTMLButtonElement[];
  readonly afterSubmit: () => void;
};

export function createFormDialog(options: FormDialogOptions): {
  show(title: string, submitLabel: string, body: readonly Node[], handler: DialogSubmit): void;
  close(): void;
} {
  const { dialog, form, title, body, submitButton, cancelButtons, afterSubmit } = options;
  let submit: DialogSubmit | undefined;

  function close(): void {
    if (dialog.open) dialog.close();
    submit = undefined;
  }

  function show(
    nextTitle: string,
    submitLabel: string,
    nextBody: readonly Node[],
    handler: DialogSubmit,
  ): void {
    title.textContent = nextTitle;
    submitButton.textContent = submitLabel;
    body.replaceChildren(...nextBody);
    for (const control of body.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >('input, select, textarea')) {
      control.addEventListener('input', () => control.setCustomValidity(''));
      control.addEventListener('change', () => control.setCustomValidity(''));
    }
    submit = handler;
    dialog.showModal();
  }

  for (const button of cancelButtons) button.addEventListener('click', close);
  dialog.addEventListener('cancel', () => { submit = undefined; });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (submit?.() !== false) {
      close();
      afterSubmit();
    } else {
      form.reportValidity();
    }
  });
  return { show, close };
}
