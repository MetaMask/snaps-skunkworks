import { logError } from '@metamask/snaps-utils';
import type { ChangeEvent, FormEvent, FunctionComponent } from 'react';
import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';

import { ButtonSpinner } from './ButtonSpinner';
import packageJson from '../../package.json';
import { useInstallSnapMutation } from '../api';
import { useInstalled } from '../utils';

type ConnectProps = {
  name: string;
  testId: string;
  snapId?: string;
  version?: string;
};

export const Connect: FunctionComponent<ConnectProps> = ({
  name,
  testId,
  snapId: defaultSnapId = '',
  version: defaultVersion,
}) => {
  const [installSnap, { isLoading }] = useInstallSnapMutation();
  const [snapId, setSnapId] = useState(defaultSnapId);
  const isInstalled = useInstalled(snapId);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSnapId(event.target.value);
  };

  const handleConnect = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    installSnap({
      snapId,
      version: defaultVersion ?? packageJson.version,
    }).catch(logError);
  };

  return (
    <Form onSubmit={handleConnect} className="mb-3">
      <Form.Group className="mb-3">
        <Form.Label>Snap ID</Form.Label>
        <Form.Control
          type="text"
          placeholder="Snap ID"
          value={snapId}
          onChange={handleChange}
          data-testid="connect-snap-id"
          disabled={true}
        />
      </Form.Group>

      <Button
        variant="primary"
        type="submit"
        id={`connect${testId}`}
        data-testid="connect-button"
        disabled={isLoading}
      >
        {isLoading ? (
          <ButtonSpinner>Connecting</ButtonSpinner>
        ) : (
          <span>
            {isInstalled ? 'Reconnect' : 'Connect'} to {name}
          </span>
        )}
      </Button>
    </Form>
  );
};
