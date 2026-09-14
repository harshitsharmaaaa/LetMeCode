#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/a9819f75a74bcb335ad4cfb5a2d1e44f1b6a2f34842b7b611080b10237325db7/contract';
import startContract from '../../snapshots/a9819f75a74bcb335ad4cfb5a2d1e44f1b6a2f34842b7b611080b10237325db7/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b2a7de84a27ad4ba56749079d190861533e8566ce0696fbe846126e6200d2178/contract';
import endContract from '../../snapshots/b2a7de84a27ad4ba56749079d190861533e8566ce0696fbe846126e6200d2178/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'submission',
        columns: [
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('language', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('problemId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('QUEUED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'submission_status_check_2873ad17',
            "\"status\" IN ('QUEUED', 'RUNNING', 'ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED', 'RUNTIME_ERROR', 'COMPILE_ERROR', 'INTERNAL_ERROR')",
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'submission',
        index: 'submission_problemId_idx_0024556d',
        columns: ['problemId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'submission',
        foreignKey: {
          name: 'submission_problemId_fkey',
          columns: ['problemId'],
          references: { schema: 'public', table: 'problem', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
