import {
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
} from '@chakra-ui/react';
import { HandlerType } from '@metamask/snaps-utils';
import type { FunctionComponent } from 'react';
import { Controller, useForm } from 'react-hook-form';

import type { CronjobData } from './CronjobPrefill';
import { CronjobPrefills } from './CronjobPrefills';
import { Editor } from '../../../../components';
import { useDispatch, useSelector } from '../../../../hooks';
import { sendRequest } from '../../../simulation';
import { SAMPLE_JSON_RPC_REQUEST } from '../../json-rpc/schema';
import { getCronjobRequest } from '../slice';

type CronjobFormData = {
  origin: string;
  request: string;
};

export const Request: FunctionComponent = () => {
  const { request, origin } = useSelector(getCronjobRequest);
  const {
    handleSubmit,
    register,
    control,
    setValue,
    formState: { errors },
  } = useForm<CronjobFormData>({
    defaultValues: {
      origin: origin ?? '',
      request: request
        ? JSON.stringify(request, null, 2)
        : SAMPLE_JSON_RPC_REQUEST,
    },
  });

  const dispatch = useDispatch();

  const onSubmit = (data: CronjobFormData) => {
    dispatch(
      sendRequest({
        origin: data.origin,
        handler: HandlerType.OnCronjob,
        request: JSON.parse(data.request),
      }),
    );
  };

  const handlePrefill = (data: CronjobData) => {
    setValue(
      'request',
      JSON.stringify(
        {
          jsonrpc: '2.0',
          id: 1,
          ...data,
        },
        null,
        2,
      ),
    );
  };

  return (
    <Flex
      as="form"
      flexDirection="column"
      flex="1"
      /* eslint-disable-next-line @typescript-eslint/no-misused-promises */
      onSubmit={handleSubmit(onSubmit)}
      id="request-form"
    >
      <CronjobPrefills onClick={handlePrefill} />

      <FormControl isInvalid={Boolean(errors.origin)}>
        <FormLabel htmlFor="origin">Origin</FormLabel>
        <Input
          id="origin"
          placeholder="metamask.io"
          fontFamily="code"
          {...register('origin')}
        />
        <FormErrorMessage>{errors.origin?.message}</FormErrorMessage>
      </FormControl>

      <FormControl
        isInvalid={Boolean(errors.request)}
        display="flex"
        flexDirection="column"
        flex="1"
      >
        <FormLabel htmlFor="request">Request</FormLabel>
        <Controller
          control={control}
          name="request"
          render={({ field: { onChange, value } }) => (
            <Editor onChange={onChange} value={value} />
          )}
        />
      </FormControl>
    </Flex>
  );
};
