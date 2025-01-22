import { createSnapComponent } from '../../component';

/**
 * The props of the {@link FileInput} component.
 *
 * @property name - The name of the file input field. This is used to identify
 * the file input field in the form data.
 * @property label - The label of the file input field.
 * @property accept - The file types that the file input field accepts. If not
 * specified, the file input field accepts all file types.
 * @property compact - Whether the file input field is compact. Default is
 * `false`.
 * @property disabled - whether the file input is disabled.
 */
export type FileInputProps = {
  name: string;
  accept?: string[] | undefined;
  compact?: boolean | undefined;
  disabled?: boolean | undefined;
};

const TYPE = 'FileInput';

/**
 * A file input component, which is used to create a file input field. This
 * component can only be used as a child of the {@link Field} component.
 *
 * The total size of the files that can be uploaded may not exceed 64 MB.
 *
 * @param props - The props of the component.
 * @param props.name - The name of the file input field. This is used to
 * identify the file input field in the form data.
 * @param props.accept - The file types that the file input field accepts. If
 * not specified, the file input field accepts all file types. For examples of
 * valid values, see the [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/accept).
 * @param props.compact - Whether the file input field is compact. Default is
 * `false`.
 * @param props.disabled - Whether the file input is disabled.
 * @returns A file input element.
 * @example
 * <FileInput name="file" accept={['image/*']} />
 * @example
 * <FileInput name="file" compact />
 * @example
 * <Field label="Upload file">
 *   <FileInput name="file" />
 * </Field>
 */
export const FileInput = createSnapComponent<FileInputProps, typeof TYPE>(TYPE);

/**
 * A file input element.
 *
 * @see FileInput
 */
export type FileInputElement = ReturnType<typeof FileInput>;
