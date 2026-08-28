/** Starter sources for the studio — one per diagram type, across both inputs. */

import type { StudioMode } from './types.js';

export interface Example {
  label: string;
  mode: StudioMode;
  source: string;
}

export const EXAMPLES: Example[] = [
  {
    label: 'Flowchart',
    mode: 'mermaid',
    source: `flowchart TD
  start([Order received]) --> stock{In stock?}
  stock -- no --> backorder[/Notify customer/]
  stock -- yes --> charge[Charge payment]
  subgraph Fulfilment
    pack[[Pack shipment]]
    ship[Hand to carrier]
  end
  charge --> pack --> ship --> done([Delivered])
  charge -.-> ledger[(Ledger)]
  backorder --> start`,
  },
  {
    label: 'Sequence',
    mode: 'mermaid',
    source: `sequenceDiagram
  title Checkout
  actor User
  participant API as Orders API
  participant PSP as Payment provider
  participant DB as Postgres
  User->>+API: POST /orders
  API->>+DB: INSERT order
  DB-->>-API: order_id
  API->>+PSP: authorize(amount)
  PSP-->>-API: approved
  API-->>-User: 201 Created
  Note right of PSP: 3DS may add a redirect`,
  },
  {
    label: 'ER diagram',
    mode: 'spec',
    source: JSON.stringify(
      {
        type: 'erd',
        title: 'Orders',
        entities: [
          {
            id: 'CUSTOMER',
            fields: [
              { name: 'id', type: 'uuid', key: 'PK' },
              { name: 'email', type: 'text', key: 'UK', comment: 'Login identity' },
              { name: 'name', type: 'text' },
            ],
          },
          {
            id: 'ORDER',
            fields: [
              { name: 'id', type: 'uuid', key: 'PK' },
              { name: 'customer_id', type: 'uuid', key: 'FK' },
              { name: 'total', type: 'numeric' },
              { name: 'placed_at', type: 'timestamptz' },
            ],
          },
          {
            id: 'LINE_ITEM',
            fields: [
              { name: 'id', type: 'uuid', key: 'PK' },
              { name: 'order_id', type: 'uuid', key: 'FK' },
              { name: 'quantity', type: 'int' },
            ],
          },
        ],
        relationships: [
          {
            from: 'CUSTOMER',
            to: 'ORDER',
            fromCardinality: 'one',
            toCardinality: 'zero-or-many',
            label: 'places',
          },
          {
            from: 'ORDER',
            to: 'LINE_ITEM',
            fromCardinality: 'one',
            toCardinality: 'one-or-many',
            label: 'contains',
          },
        ],
      },
      null,
      2,
    ),
  },
];
