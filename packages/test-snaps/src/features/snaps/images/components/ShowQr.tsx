import { logError } from '@metamask/snaps-utils';
import { useState } from 'react';
import type {
  FunctionComponent,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { Button, Form } from 'react-bootstrap';

import { useInvokeMutation } from '../../../../api';
import { Result } from '../../../../components';
import { getSnapId } from '../../../../utils';
import { IMAGES_SNAP_ID, IMAGES_SNAP_PORT } from '../constants';

export const ShowQr: FunctionComponent = () => {
  const [data, setData] = useState('');
  const [invokeSnap, { isLoading, error }] = useInvokeMutation();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setData(event.target.value);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    invokeSnap({
      snapId: getSnapId(IMAGES_SNAP_ID, IMAGES_SNAP_PORT),
      method: 'getQrCode',
      params: {
        data,
      },
    }).catch(logError);
  };

  return (
    <>
      <Form onSubmit={handleSubmit} className="mt-3 mb-3">
        <Form.Label>Message</Form.Label>
        <Form.Control
          type="text"
          placeholder="Data"
          value={data}
          onChange={handleChange}
          id="qrData"
          className="mb-3"
        />

        <Button type="submit" id="getQrCode" disabled={isLoading}>
          Show QR code
        </Button>
      </Form>
      <Result>
        <span id="getQrCodeResult">{JSON.stringify(error, null, 2)}</span>
      </Result>
    </>
  );
};
