import { createSnapComponent } from '../../component';

/**
 * The props of the {@link FileInput} component.
 *
 * @property name - The name of the file input field. This is used to identify
 * the file input field in the form data.
 * @property label - The label of the file input field.
 * @property accept - The file types that the file input field accepts. If not
 * specified, the file input field accepts all file types.
 * @property multiple - Whether the file input field accepts multiple files.
 * Defaults to `false`.
 */
export type FileInputProps = {
  name: string;
  accept?: string[] | undefined;
  multiple?: boolean | undefined;
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
 * @param props.label - The label of the file input field.
 * @param props.accept - The file types that the file input field accepts. If
 * not specified, the file input field accepts all file types.
 * @param props.multiple - Whether the file input field accepts multiple files.
 * @returns A file input element.
 * @example
 * <FileInput name="file" accept={['image/*']} multiple />
 * @example
 * <Field label="Upload file">
 */
export const FileInput = createSnapComponent<FileInputProps, typeof TYPE>(TYPE);

/**
 * A file input element.
 *
 * @see FileInput
 */
export type FileInputElement = ReturnType<typeof FileInput>;