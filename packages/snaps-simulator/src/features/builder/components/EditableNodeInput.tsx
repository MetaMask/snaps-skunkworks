import { Input as ChakraInput } from '@chakra-ui/react';
import { useState } from 'react';
import type { ChangeEvent, type FunctionComponent } from 'react';

type EditableNodeInputProps = {
  placeholder: string;
  defaultValue: string | undefined;
  onChange?: (value: string) => void;
};

/**
 * A text field for an editable node text field, which renders an input field in the editable component.
 *
 * @param props - The props of the component.
 * @param props.placeholder - The placeholder of the input field.
 * @param props.defaultValue - The property default value.
 * @param props.onChange - A function to call when the dropdown changes.
 * @returns An editable node text field component.
 */
export const EditableNodeInput: FunctionComponent<EditableNodeInputProps> = ({
  placeholder,
  defaultValue,
  onChange,
}) => {
  const [value, setValue] = useState(defaultValue);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
    onChange?.(event.target.value);
  };

  return (
    <ChakraInput
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      fontSize="sm"
      bg="chakra-body-bg"
      borderColor="border.default"
      outline="none"
      _active={{
        borderColor: 'border.active',
        outline: 'none',
        boxShadow: 'none',
      }}
      _focusVisible={{
        borderColor: 'border.active',
        outline: 'none',
        boxShadow: 'none',
      }}
      _placeholder={{
        textTransform: 'capitalize',
      }}
    />
  );
};
