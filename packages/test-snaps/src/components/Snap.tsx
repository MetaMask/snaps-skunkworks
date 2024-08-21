import type { FunctionComponent, ReactNode } from 'react';
import { Card, Col } from 'react-bootstrap';
import CardHeader from 'react-bootstrap/CardHeader';

import { Connect } from './Connect';
import { getSnapId } from '../utils';

export type SnapProps = {
  /**
   * The name of the snap.
   */
  name: string;

  /**
   * The `data-testid` of the snap.
   */
  testId: string;

  /**
   * The snap ID. This is only used in production.
   */
  snapId?: `npm:${string}`;

  /**
   * The port that the snap is listening on. This is only used in development.
   */
  port?: number;

  /**
   * The version of the snap. This should be the version that is used in the
   * snap's `package.json`.
   */
  version: string;

  hideConnect?: boolean;
  children?: ReactNode;
};

export const Snap: FunctionComponent<SnapProps> = ({
  name,
  snapId,
  testId,
  port,
  version,
  hideConnect,
  children,
}) => (
  <Col>
    <Card data-testid={testId}>
      <CardHeader>
        <h2 className="h4 mb-0">{name}</h2>
      </CardHeader>
      <div className="card-body">
        {!hideConnect && (
          <Connect
            name={name}
            testId={testId}
            snapId={getSnapId(snapId, port)}
            version={version}
          />
        )}

        {children}
      </div>
    </Card>
  </Col>
);
