#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/b2a7de84a27ad4ba56749079d190861533e8566ce0696fbe846126e6200d2178/contract';
import startContract from '../../snapshots/b2a7de84a27ad4ba56749079d190861533e8566ce0696fbe846126e6200d2178/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/fa95b34359cd3368434de0d34a8ee991a6d4e7fe8485939b0798ecf6f8f69df0/contract';
import endContract from '../../snapshots/fa95b34359cd3368434de0d34a8ee991a6d4e7fe8485939b0798ecf6f8f69df0/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'submission',
        column: col('executionTimeMs', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'submission',
        column: col('failedTestNumber', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'submission',
        column: col('passedTests', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'submission',
        column: col('totalTests', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
