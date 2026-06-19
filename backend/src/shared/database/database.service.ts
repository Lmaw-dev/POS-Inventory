import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import * as bcrypt from 'bcrypt';
import { AuthenticatedUser } from '../common/types';

type ColumnInfo = {
  column_name: string;
};

type SchemaColumns = {
  users: Set<string>;
  stores: Set<string>;
};

type StoreInformation = {
  id: number;
  store_id: number;
  business_name: string;
  business_description: string | null;
  address: string | null;
  contact_number: string | null;
  email: string | null;
  logo: string | null;
  receipt_thank_you_message: string | null;
  receipt_footer_message: string | null;
  operating_hours: string | null;
  currency: string | null;
  theme_color: string | null;
  tax_rate: string | number | null;
  service_charge_rate: string | number | null;
  updated_at: Date | string | null;
};

type StaffType = 'POS_STAFF' | 'INVENTORY_STAFF' | 'MANAGER';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  /*
   * Legacy compatibility layer for the original POS SQL workflows.
   * New modules should inject PrismaService from src/prisma instead of adding
   * more raw pg queries here. Existing methods will be migrated module by module.
   */
  private readonly pool: Pool;
  private schemaColumns: SchemaColumns | null = null;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const maxPoolConnections = Number(process.env.DB_POOL_MAX ?? 1);
    const poolOptions = {
      max: Number.isFinite(maxPoolConnections) && maxPoolConnections > 0 ? maxPoolConnections : 1,
      idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? 10000),
      connectionTimeoutMillis: Number(process.env.DB_POOL_CONNECTION_TIMEOUT_MS ?? 10000),
      allowExitOnIdle: true,
    };

    this.pool = connectionString
      ? new Pool({ connectionString, ...poolOptions })
      : new Pool({
          host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 5432),
          user: process.env.DB_USER ?? 'postgres',
          password: process.env.DB_PASSWORD ?? '',
          database: process.env.DB_NAME ?? 'bukolabs_pos',
          ...poolOptions,
        });
  }

  async onModuleInit() {
    return;
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    try {
      const result = await this.pool.query<T>(sql, params);
      return result.rows;
    } catch (error) {
      if (this.isDatabaseConnectionLimitError(error)) {
        throw new ServiceUnavailableException('PostgreSQL connection limit reached. Stop extra backend processes, wait 30-60 seconds for Supabase to release stale sessions, then start only one backend.');
      }

      if (!this.isDatabaseConnectivityError(error)) {
        throw error;
      }

      throw new ServiceUnavailableException('PostgreSQL is not reachable or is missing credentials. Check backend/.env and database status.');
    }
  }

  async withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    let client: PoolClient;

    try {
      client = await this.pool.connect();
    } catch (error) {
      if (this.isDatabaseConnectionLimitError(error)) {
        throw new ServiceUnavailableException('PostgreSQL connection limit reached. Stop extra backend processes, wait 30-60 seconds for Supabase to release stale sessions, then start only one backend.');
      }

      if (this.isDatabaseConnectivityError(error)) {
        throw new ServiceUnavailableException('PostgreSQL is not reachable or is missing credentials. Check backend/.env and database status.');
      }

      throw error;
    }

    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async queryWithClient<T extends QueryResultRow>(client: PoolClient, sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await client.query<T>(sql, params);
    return result.rows;
  }

  private isDatabaseConnectionLimitError(error: unknown): boolean {
    const databaseError = error as { code?: string; message?: string };
    const message = databaseError.message ?? '';

    return databaseError.code === '53300' || message.includes('max clients reached') || message.includes('EMAXCONNSESSION');
  }

  private isDatabaseConnectivityError(error: unknown): boolean {
    const databaseError = error as { code?: string };
    const connectionErrorCodes = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', '28P01', '3D000', 'XX000']);

    return Boolean(databaseError.code && connectionErrorCodes.has(databaseError.code));
  }

  async getLoginUserByEmail(email: string): Promise<AuthenticatedUser & { password_hash: string } | null> {
    const schema = await this.getSchemaColumns();
    const userColumns = this.resolveUserColumns(schema.users);
    const storeColumns = this.resolveStoreColumns(schema.stores);

    const passwordColumn = userColumns.passwordColumn;
    const fullNameColumn = userColumns.fullNameColumn;
    const roleColumn = userColumns.roleColumn;
    const storeIdColumn = userColumns.storeIdColumn;
    const staffTypeColumn = userColumns.staffTypeColumn;

    if (!passwordColumn || !fullNameColumn || !roleColumn) {
      throw new InternalServerErrorException('Users table is missing required columns for login.');
    }

    const storeTypeSelect = storeColumns.storeTypeColumn ? `${this.normalizedStoreTypeSql(`s.${this.quoteIdentifier(storeColumns.storeTypeColumn)}`)} AS store_type` : 'NULL AS store_type';
    const storeNameSelect = storeColumns.storeNameColumn ? `s.${this.quoteIdentifier(storeColumns.storeNameColumn)} AS store_name` : 'NULL AS store_name';
    const storeJoin = storeIdColumn && storeColumns.joinable ? `LEFT JOIN stores s ON s.id = u.${this.quoteIdentifier(storeIdColumn)}` : '';
    const storeIdSelect = storeIdColumn ? `u.${this.quoteIdentifier(storeIdColumn)} AS store_id` : 'NULL AS store_id';
    const staffTypeSelect = staffTypeColumn ? `u.${this.quoteIdentifier(staffTypeColumn)} AS staff_type` : 'NULL AS staff_type';

    const rows = await this.query<{
      id: number;
      full_name: string;
      email: string;
      role: string;
      store_id: number | null;
      staff_type: StaffType | null;
      password_hash: string;
      store_type: string | null;
      store_name: string | null;
      status: string | null;
    }>(
      `
        SELECT
          u.id,
          u.${this.quoteIdentifier(fullNameColumn)} AS full_name,
          u.email,
          u.${this.quoteIdentifier(roleColumn)} AS role,
          ${storeIdSelect},
          ${staffTypeSelect},
          u.${this.quoteIdentifier(passwordColumn)} AS password_hash,
          ${storeTypeSelect},
          ${storeNameSelect},
          ${userColumns.statusColumn ? `u.${this.quoteIdentifier(userColumns.statusColumn)} AS status` : `'ACTIVE' AS status`}
        FROM users u
        ${storeJoin}
        WHERE LOWER(u.email) = LOWER($1)
        ${this.activeUsersWhereClause(userColumns)}
        LIMIT 1
      `,
      [email],
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0];
  }

  async listAdminUsers() {
    const schema = await this.getSchemaColumns();
    const userColumns = this.resolveUserColumns(schema.users);
    const storeColumns = this.resolveStoreColumns(schema.stores);

    if (!userColumns.fullNameColumn || !userColumns.roleColumn) {
      throw new InternalServerErrorException('Users table is missing required columns for admin listing.');
    }

    const storeJoin = userColumns.storeIdColumn && storeColumns.joinable ? `LEFT JOIN stores s ON s.id = u.${this.quoteIdentifier(userColumns.storeIdColumn)} LEFT JOIN store_information si ON si.store_id = s.id` : '';
    const storeTypeSelect = storeColumns.storeTypeColumn ? `${this.normalizedStoreTypeSql(`s.${this.quoteIdentifier(storeColumns.storeTypeColumn)}`)} AS store_type` : 'NULL AS store_type';
    const storeNameSelect = storeJoin
      ? storeColumns.storeNameColumn
        ? `COALESCE(si.business_name, s.${this.quoteIdentifier(storeColumns.storeNameColumn)}) AS store_name`
        : 'si.business_name AS store_name'
      : 'NULL AS store_name';

    return this.query<{
      id: number;
      full_name: string;
      email: string;
      role: string;
      store_id: number | null;
      store_type: string | null;
      store_name: string | null;
      staff_type: StaffType | null;
      status: string | null;
    }>(
      `
        SELECT
          u.id,
          u.${this.quoteIdentifier(userColumns.fullNameColumn)} AS full_name,
          u.email,
          u.${this.quoteIdentifier(userColumns.roleColumn)} AS role,
          ${userColumns.storeIdColumn ? `u.${this.quoteIdentifier(userColumns.storeIdColumn)} AS store_id` : 'NULL AS store_id'},
          ${storeTypeSelect},
          ${storeNameSelect},
          ${userColumns.staffTypeColumn ? `u.${this.quoteIdentifier(userColumns.staffTypeColumn)} AS staff_type` : 'NULL AS staff_type'},
          ${userColumns.statusColumn ? `u.${this.quoteIdentifier(userColumns.statusColumn)} AS status` : `'ACTIVE' AS status`}
        FROM users u
        ${storeJoin}
        WHERE u.${this.quoteIdentifier(userColumns.roleColumn)} = 'ADMIN'
        ORDER BY u.id ASC
      `,
    );
  }

  async comparePassword(plainPassword: string, hashedPassword: string) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async createAdminAccount(input: { fullName: string; email: string; storeType: 'RESTAURANT' | 'RETAIL_STORE'; password?: string }) {
    const schema = await this.getSchemaColumns();
    const userColumns = this.resolveUserColumns(schema.users);
    const storeColumns = this.resolveStoreColumns(schema.stores);

    if (!userColumns.fullNameColumn || !userColumns.roleColumn || !userColumns.passwordColumn) {
      throw new InternalServerErrorException('Users table is missing required columns for admin creation.');
    }

    if (!storeColumns.storeTypeColumn) {
      throw new InternalServerErrorException('Stores table is missing a store type column.');
    }

    const password = input.password ?? this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(password, 10);

    try {
      return await this.withTransaction(async (client) => {
      const storeInsertColumns: string[] = [this.quoteIdentifier(storeColumns.storeTypeColumn!)];
      const storeInsertValues: unknown[] = [this.toDatabaseStoreType(input.storeType)];
      const storeInsertPlaceholders: string[] = ['$1'];

      if (storeColumns.storeNameColumn) {
        storeInsertColumns.push(this.quoteIdentifier(storeColumns.storeNameColumn));
        storeInsertValues.push(`${input.fullName}'s Store`);
        storeInsertPlaceholders.push(`$${storeInsertValues.length}`);
      }

      const storeRows = await this.queryWithClient<{ id: number }>(
        client,
        `
          INSERT INTO stores (${storeInsertColumns.join(', ')})
          VALUES (${storeInsertPlaceholders.join(', ')})
          RETURNING id
        `,
        storeInsertValues,
      );

      const storeId = storeRows[0]?.id ?? null;

      const userInsertColumns: string[] = [this.quoteIdentifier(userColumns.fullNameColumn!), 'email', this.quoteIdentifier(userColumns.roleColumn!), this.quoteIdentifier(userColumns.passwordColumn!)];
      const userInsertValues: unknown[] = [input.fullName, input.email, 'ADMIN', passwordHash];
      const userInsertPlaceholders: string[] = ['$1', '$2', '$3', '$4'];

      if (userColumns.storeIdColumn) {
        userInsertColumns.push(this.quoteIdentifier(userColumns.storeIdColumn));
        userInsertValues.push(storeId);
        userInsertPlaceholders.push(`$${userInsertValues.length}`);
      }

      if (userColumns.staffTypeColumn) {
        userInsertColumns.push(this.quoteIdentifier(userColumns.staffTypeColumn));
        userInsertValues.push(null);
        userInsertPlaceholders.push(`$${userInsertValues.length}`);
      }

      const userRows = await this.queryWithClient<{
        id: number;
        full_name: string;
        email: string;
        role: string;
        store_id: number | null;
        staff_type: StaffType | null;
      }>(
        client,
        `
          INSERT INTO users (${userInsertColumns.join(', ')})
          VALUES (${userInsertPlaceholders.join(', ')})
          RETURNING
            id,
            ${this.quoteIdentifier(userColumns.fullNameColumn!)} AS full_name,
            email,
            ${this.quoteIdentifier(userColumns.roleColumn!)} AS role,
            ${userColumns.storeIdColumn ? `${this.quoteIdentifier(userColumns.storeIdColumn)} AS store_id` : 'NULL AS store_id'},
            ${userColumns.staffTypeColumn ? `${this.quoteIdentifier(userColumns.staffTypeColumn)} AS staff_type` : 'NULL AS staff_type'}
        `,
        userInsertValues,
      );

      if (storeId) {
        await this.ensureStoreInformationRow(storeId, storeColumns.storeNameColumn ? `${input.fullName}'s Store` : input.fullName, client);
      }

      return {
        user: { ...userRows[0], store_type: input.storeType, store_name: storeColumns.storeNameColumn ? `${input.fullName}'s Store` : null },
        store: { id: storeId, store_type: input.storeType, store_name: storeColumns.storeNameColumn ? `${input.fullName}'s Store` : null },
        temporary_password: input.password ? null : password,
      };
      });
    } catch (error) {
      this.handleDatabaseWriteError(error, 'Unable to create admin account.');
    }
  }

  async updateAdminAccount(input: { adminUserId: number; fullName: string; email: string; storeType: 'RESTAURANT' | 'RETAIL_STORE'; password?: string }) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Admin account was not found.');
    }

    const schema = await this.getSchemaColumns();
    const userColumns = this.resolveUserColumns(schema.users);
    const storeColumns = this.resolveStoreColumns(schema.stores);

    if (!userColumns.fullNameColumn || !userColumns.roleColumn) {
      throw new InternalServerErrorException('Users table is missing required columns for admin updates.');
    }

    const roleColumn = userColumns.roleColumn;
    const userUpdates: string[] = [`${this.quoteIdentifier(userColumns.fullNameColumn)} = $1`, 'email = $2'];
    const values: unknown[] = [input.fullName, input.email];

    if (input.password?.trim()) {
      if (!userColumns.passwordColumn) {
        throw new InternalServerErrorException('Users table is missing a password column.');
      }

      values.push(await bcrypt.hash(input.password, 10));
      userUpdates.push(`${this.quoteIdentifier(userColumns.passwordColumn)} = $${values.length}`);
    }

    try {
      await this.withTransaction(async (client) => {
        values.push(input.adminUserId);
        await this.queryWithClient(
          client,
          `
            UPDATE users
            SET ${userUpdates.join(', ')}
            WHERE id = $${values.length}
              AND ${this.quoteIdentifier(roleColumn)} = 'ADMIN'
          `,
          values,
        );

        if (storeColumns.storeTypeColumn) {
          await this.queryWithClient(
            client,
            `
              UPDATE stores
              SET ${this.quoteIdentifier(storeColumns.storeTypeColumn)} = $1
              WHERE id = $2
            `,
            [this.toDatabaseStoreType(input.storeType), admin.store_id],
          );
        }
      });

      const updated = await this.getUserStoreScope(input.adminUserId);
      return updated;
    } catch (error) {
      this.handleDatabaseWriteError(error, 'Unable to update admin account.');
    }
  }

  async deleteAdminAccount(adminUserId: number) {
    if (!Number.isFinite(adminUserId) || adminUserId <= 0) {
      throw new BadRequestException('A valid admin user id is required.');
    }

    const admin = await this.getUserStoreScope(adminUserId);

    if (admin.role !== 'ADMIN') {
      throw new NotFoundException('Admin account was not found.');
    }

    const schema = await this.getSchemaColumns();
    const userColumns = this.resolveUserColumns(schema.users);

    if (!userColumns.roleColumn) {
      throw new InternalServerErrorException('Users table is missing required columns for admin deletion.');
    }

    const deactivatedIds = await this.deactivateAdminAndStoreStaff(adminUserId, admin.store_id, userColumns);
    return { id: adminUserId, status: 'INACTIVE', deactivated: true, deleted: false, affected_user_ids: deactivatedIds };
  }

  async permanentlyDeleteAdminAccount(adminUserId: number) {
    if (!Number.isFinite(adminUserId) || adminUserId <= 0) {
      throw new BadRequestException('A valid admin user id is required.');
    }

    const admin = await this.getUserStoreScope(adminUserId);

    if (admin.role !== 'ADMIN') {
      throw new NotFoundException('Admin account was not found.');
    }

    const schema = await this.getSchemaColumns();
    const userColumns = this.resolveUserColumns(schema.users);

    if (!userColumns.roleColumn) {
      throw new InternalServerErrorException('Users table is missing required columns for admin deletion.');
    }

    try {
      const rows = await this.hardDeleteUserByRole(adminUserId, 'ADMIN', null, userColumns);

      if (rows.length === 0) {
        throw new NotFoundException('Admin account was not found.');
      }

      return { id: rows[0].id, deleted: true, deactivated: false };
    } catch (error) {
      this.handleDatabaseWriteError(error, 'Unable to delete admin account.');
    }
  }

  async activateAdminAccount(adminUserId: number) {
    if (!Number.isFinite(adminUserId) || adminUserId <= 0) {
      throw new BadRequestException('A valid admin user id is required.');
    }

    const admin = await this.getUserStoreScope(adminUserId);

    if (admin.role !== 'ADMIN') {
      throw new NotFoundException('Admin account was not found.');
    }

    const schema = await this.getSchemaColumns();
    const userColumns = this.resolveUserColumns(schema.users);

    if (!userColumns.statusColumn || !userColumns.roleColumn) {
      throw new InternalServerErrorException('Users table is missing required status columns.');
    }

    const activatedIds = await this.activateAdminAndStoreStaff(adminUserId, admin.store_id, userColumns);
    return { id: adminUserId, status: 'ACTIVE', activated: true, affected_user_ids: activatedIds };
  }

  async listStaffForAdmin(adminUserId: number) {
    const admin = await this.getUserStoreScope(adminUserId);

    if (!admin.store_id) {
      throw new InternalServerErrorException('Admin account is not linked to a store.');
    }

    const schema = await this.getSchemaColumns();
    const userColumns = this.resolveUserColumns(schema.users);
    const storeColumns = this.resolveStoreColumns(schema.stores);

    if (!userColumns.fullNameColumn || !userColumns.roleColumn || !userColumns.storeIdColumn) {
      throw new InternalServerErrorException('Users table is missing required columns for staff listing.');
    }

    const storeJoin = storeColumns.joinable ? `LEFT JOIN stores s ON s.id = u.${this.quoteIdentifier(userColumns.storeIdColumn)}` : '';
    const storeTypeSelect = storeColumns.storeTypeColumn ? `${this.normalizedStoreTypeSql(`s.${this.quoteIdentifier(storeColumns.storeTypeColumn)}`)} AS store_type` : 'NULL AS store_type';
    const storeNameSelect = storeColumns.storeNameColumn ? `s.${this.quoteIdentifier(storeColumns.storeNameColumn)} AS store_name` : 'NULL AS store_name';

    return this.query<AuthenticatedUser>(
      `
        SELECT
          u.id,
          u.${this.quoteIdentifier(userColumns.fullNameColumn)} AS full_name,
          u.email,
          u.${this.quoteIdentifier(userColumns.roleColumn)} AS role,
          u.${this.quoteIdentifier(userColumns.storeIdColumn)} AS store_id,
          ${userColumns.staffTypeColumn ? `u.${this.quoteIdentifier(userColumns.staffTypeColumn)} AS staff_type` : 'NULL AS staff_type'},
          ${storeTypeSelect},
          ${storeNameSelect},
          ${userColumns.statusColumn ? `u.${this.quoteIdentifier(userColumns.statusColumn)} AS status` : `'ACTIVE' AS status`}
        FROM users u
        ${storeJoin}
        WHERE u.${this.quoteIdentifier(userColumns.roleColumn)} = 'STAFF'
          AND u.${this.quoteIdentifier(userColumns.storeIdColumn)} = $1
        ORDER BY u.id ASC
      `,
      [admin.store_id],
    );
  }

  async createStaffAccount(input: {
    adminUserId: number;
    fullName: string;
    email: string;
    password: string;
    staffType: StaffType;
  }) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can create staff.');
    }

    const schema = await this.getSchemaColumns();
    const userColumns = this.resolveUserColumns(schema.users);

    if (!userColumns.fullNameColumn || !userColumns.roleColumn || !userColumns.passwordColumn || !userColumns.storeIdColumn || !userColumns.staffTypeColumn) {
      throw new InternalServerErrorException('Users table is missing required columns for staff creation.');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const rows = await this.query<AuthenticatedUser>(
      `
        INSERT INTO users (
          ${this.quoteIdentifier(userColumns.fullNameColumn)},
          email,
          ${this.quoteIdentifier(userColumns.roleColumn)},
          ${this.quoteIdentifier(userColumns.passwordColumn)},
          ${this.quoteIdentifier(userColumns.storeIdColumn)},
          ${this.quoteIdentifier(userColumns.staffTypeColumn)}
        )
        VALUES ($1, $2, 'STAFF', $3, $4, $5)
        RETURNING
          id,
          ${this.quoteIdentifier(userColumns.fullNameColumn)} AS full_name,
          email,
          ${this.quoteIdentifier(userColumns.roleColumn)} AS role,
          ${this.quoteIdentifier(userColumns.storeIdColumn)} AS store_id,
          ${this.quoteIdentifier(userColumns.staffTypeColumn)} AS staff_type,
          $6::text AS store_type,
          $7::text AS store_name,
          ${userColumns.statusColumn ? `${this.quoteIdentifier(userColumns.statusColumn)} AS status` : `'ACTIVE' AS status`}
      `,
      [input.fullName, input.email, passwordHash, admin.store_id, input.staffType, admin.store_type, admin.store_name],
    );

    return rows[0];
  }

  async updateStaffAccountForAdmin(input: {
    adminUserId: number;
    staffUserId: number;
    fullName: string;
    email: string;
    password?: string;
    staffType: StaffType;
  }) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can update staff.');
    }

    const schema = await this.getSchemaColumns();
    const userColumns = this.resolveUserColumns(schema.users);
    const storeColumns = this.resolveStoreColumns(schema.stores);

    if (!userColumns.fullNameColumn || !userColumns.roleColumn || !userColumns.storeIdColumn || !userColumns.staffTypeColumn) {
      throw new InternalServerErrorException('Users table is missing required columns for staff updates.');
    }

    const updates: string[] = [
      `${this.quoteIdentifier(userColumns.fullNameColumn)} = $1`,
      `email = $2`,
      `${this.quoteIdentifier(userColumns.staffTypeColumn)} = $3`,
    ];
    const values: unknown[] = [input.fullName, input.email, input.staffType];

    if (input.password?.trim()) {
      if (!userColumns.passwordColumn) {
        throw new InternalServerErrorException('Users table is missing a password column.');
      }

      values.push(await bcrypt.hash(input.password, 10));
      updates.push(`${this.quoteIdentifier(userColumns.passwordColumn)} = $${values.length}`);
    }

    values.push(input.staffUserId, admin.store_id);
    const staffIdParam = `$${values.length - 1}`;
    const storeIdParam = `$${values.length}`;

    try {
      const storeJoin = storeColumns.joinable ? `LEFT JOIN stores s ON s.id = u.${this.quoteIdentifier(userColumns.storeIdColumn)}` : '';
      const storeTypeSelect = storeColumns.storeTypeColumn ? `${this.normalizedStoreTypeSql(`s.${this.quoteIdentifier(storeColumns.storeTypeColumn)}`)} AS store_type` : 'NULL AS store_type';
      const storeNameSelect = storeColumns.storeNameColumn ? `s.${this.quoteIdentifier(storeColumns.storeNameColumn)} AS store_name` : 'NULL AS store_name';

      const rows = await this.query<AuthenticatedUser>(
        `
          WITH updated AS (
            UPDATE users
            SET ${updates.join(', ')}
            WHERE id = ${staffIdParam}
              AND ${this.quoteIdentifier(userColumns.roleColumn)} = 'STAFF'
              AND ${this.quoteIdentifier(userColumns.storeIdColumn)} = ${storeIdParam}
            RETURNING *
          )
          SELECT
            u.id,
            u.${this.quoteIdentifier(userColumns.fullNameColumn)} AS full_name,
            u.email,
            u.${this.quoteIdentifier(userColumns.roleColumn)} AS role,
            u.${this.quoteIdentifier(userColumns.storeIdColumn)} AS store_id,
            u.${this.quoteIdentifier(userColumns.staffTypeColumn)} AS staff_type,
            ${storeTypeSelect},
            ${storeNameSelect},
            ${userColumns.statusColumn ? `u.${this.quoteIdentifier(userColumns.statusColumn)} AS status` : `'ACTIVE' AS status`}
          FROM updated u
          ${storeJoin}
          LIMIT 1
        `,
        values,
      );

      if (rows.length === 0) {
        throw new InternalServerErrorException('Staff account was not found for this store.');
      }

      return rows[0];
    } catch (error) {
      this.handleDatabaseWriteError(error, 'Unable to update staff account.');
    }
  }

  async deleteStaffAccountForAdmin(input: { adminUserId: number; staffUserId: number }) {
    if (!Number.isFinite(input.adminUserId) || input.adminUserId <= 0) {
      throw new BadRequestException('A valid admin_user_id is required.');
    }

    if (!Number.isFinite(input.staffUserId) || input.staffUserId <= 0) {
      throw new BadRequestException('A valid staff user id is required.');
    }

    if (input.adminUserId === input.staffUserId) {
      throw new ForbiddenException('You cannot remove your own account from this screen.');
    }

    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new ForbiddenException('Only store admin accounts can remove staff for their store.');
    }

    const schema = await this.getSchemaColumns();
    const userColumns = this.resolveUserColumns(schema.users);

    if (!userColumns.roleColumn || !userColumns.storeIdColumn) {
      throw new InternalServerErrorException('Users table is missing required columns for staff deletion.');
    }

    if (userColumns.statusColumn) {
      const rows = await this.deactivateStaffForStore(input.staffUserId, admin.store_id, userColumns);

      if (rows.length === 0) {
        throw new NotFoundException('Staff account was not found for this store.');
      }

      return { id: rows[0].id, status: 'INACTIVE', deactivated: true, deleted: false };
    }

    try {
      const rows = await this.hardDeleteUserByRole(input.staffUserId, 'STAFF', admin.store_id, userColumns);

      if (rows.length === 0) {
        throw new NotFoundException('Staff account was not found for this store.');
      }

      return { id: rows[0].id, deleted: true, deactivated: false };
    } catch (error) {
      this.handleDatabaseWriteError(error, 'Unable to remove staff account.');
    }
  }

  async permanentlyDeleteStaffAccountForAdmin(input: { adminUserId: number; staffUserId: number }) {
    if (!Number.isFinite(input.adminUserId) || input.adminUserId <= 0) {
      throw new BadRequestException('A valid admin_user_id is required.');
    }

    if (!Number.isFinite(input.staffUserId) || input.staffUserId <= 0) {
      throw new BadRequestException('A valid staff user id is required.');
    }

    if (input.adminUserId === input.staffUserId) {
      throw new ForbiddenException('You cannot remove your own account from this screen.');
    }

    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new ForbiddenException('Only store admin accounts can remove staff for their store.');
    }

    const schema = await this.getSchemaColumns();
    const userColumns = this.resolveUserColumns(schema.users);

    if (!userColumns.roleColumn || !userColumns.storeIdColumn) {
      throw new InternalServerErrorException('Users table is missing required columns for staff deletion.');
    }

    try {
      const rows = await this.hardDeleteUserByRole(input.staffUserId, 'STAFF', admin.store_id, userColumns);

      if (rows.length === 0) {
        throw new NotFoundException('Staff account was not found for this store.');
      }

      return { id: rows[0].id, deleted: true, deactivated: false };
    } catch (error) {
      this.handleDatabaseWriteError(error, 'Unable to delete staff account.');
    }
  }

  async activateStaffAccountForAdmin(input: { adminUserId: number; staffUserId: number }) {
    if (!Number.isFinite(input.adminUserId) || input.adminUserId <= 0) {
      throw new BadRequestException('A valid admin_user_id is required.');
    }

    if (!Number.isFinite(input.staffUserId) || input.staffUserId <= 0) {
      throw new BadRequestException('A valid staff user id is required.');
    }

    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new ForbiddenException('Only store admin accounts can activate staff for their store.');
    }

    const schema = await this.getSchemaColumns();
    const userColumns = this.resolveUserColumns(schema.users);

    if (!userColumns.statusColumn || !userColumns.roleColumn || !userColumns.storeIdColumn) {
      throw new InternalServerErrorException('Users table is missing required columns for staff activation.');
    }

    const rows = await this.activateStaffForStore(input.staffUserId, admin.store_id, userColumns);

    if (rows.length === 0) {
      throw new NotFoundException('Staff account was not found for this store.');
    }

    return { id: rows[0].id, status: 'ACTIVE', activated: true };
  }

  async getStoreInformationForAdmin(adminUserId: number): Promise<StoreInformation> {
    const user = await this.getUserStoreScope(adminUserId);

    if (!['ADMIN', 'STAFF'].includes(String(user.role)) || !user.store_id) {
      throw new InternalServerErrorException('Only store users can view store information.');
    }

    await this.ensureStoreInformationRow(user.store_id, user.store_name);

    const rows = await this.query<StoreInformation>(
      `
        SELECT
          id,
          store_id,
          business_name,
          business_description,
          address,
          contact_number,
          email,
          logo,
          receipt_thank_you_message,
          receipt_footer_message,
          operating_hours,
          currency,
          theme_color,
          tax_rate,
          service_charge_rate,
          updated_at
        FROM store_information
        WHERE store_id = $1
        LIMIT 1
      `,
      [user.store_id],
    );

    if (rows.length === 0) {
      throw new InternalServerErrorException('Store information was not found.');
    }

    return rows[0];
  }

  async updateStoreInformationForAdmin(input: {
    adminUserId: number;
    businessName: string;
    businessDescription: string | null;
    address: string | null;
    contactNumber: string | null;
    email: string | null;
    logo: string | null;
    receiptThankYouMessage: string | null;
    receiptFooterMessage: string | null;
    operatingHours: string | null;
    currency: string | null;
    themeColor: string | null;
    taxRate: number | null;
    serviceChargeRate: number | null;
  }): Promise<StoreInformation> {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can update store information.');
    }

    await this.ensureStoreInformationRow(admin.store_id, admin.store_name);

    const rows = await this.query<StoreInformation>(
      `
        UPDATE store_information
        SET
          business_name = $1,
          business_description = $2,
          address = $3,
          contact_number = $4,
          email = $5,
          logo = $6,
          receipt_thank_you_message = $7,
          receipt_footer_message = $8,
          operating_hours = $9,
          currency = $10,
          theme_color = $11,
          tax_rate = $12,
          service_charge_rate = $13,
          updated_at = CURRENT_TIMESTAMP
        WHERE store_id = $14
        RETURNING
          id,
          store_id,
          business_name,
          business_description,
          address,
          contact_number,
          email,
          logo,
          receipt_thank_you_message,
          receipt_footer_message,
          operating_hours,
          currency,
          theme_color,
          tax_rate,
          service_charge_rate,
          updated_at
      `,
      [
        input.businessName,
        input.businessDescription,
        input.address,
        input.contactNumber,
        input.email,
        input.logo,
        input.receiptThankYouMessage,
        input.receiptFooterMessage,
        input.operatingHours,
        input.currency,
        input.themeColor,
        input.taxRate,
        input.serviceChargeRate,
        admin.store_id,
      ],
    );

    return rows[0];
  }

  async getStoreSettingsForAdmin(adminUserId: number) {
    const admin = await this.getUserStoreScope(adminUserId);

    if (!admin.store_id) {
      throw new InternalServerErrorException('Only store-linked accounts can view store settings.');
    }

    await this.ensureStoreSettingsRow(admin.store_id, admin.store_type);

    const rows = await this.query(
      `
        SELECT *
        FROM store_settings
        WHERE store_id = $1
          AND (store_type = $2 OR store_type IS NULL)
        LIMIT 1
      `,
      [admin.store_id, admin.store_type],
    );

    return rows[0];
  }

  async updateStoreSettingsForAdmin(input: {
    adminUserId: number;
    enableCustomerRecommendation?: boolean;
    enableTableManagement?: boolean;
    enableRefund?: boolean;
    enableVoid?: boolean;
    enableDiscount?: boolean;
    enableServiceCharge?: boolean;
    serviceChargeRate?: number;
    enableTax?: boolean;
    taxRate?: number;
    enableDineIn?: boolean;
    enableTakeout?: boolean;
    enableIngredientCustomization?: boolean;
    enableReceiptPrinting?: boolean;
    enabledPaymentMethods?: string[];
  }) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can update store settings.');
    }

    await this.ensureStoreSettingsRow(admin.store_id, admin.store_type);

    const rows = await this.query(
      `
        UPDATE store_settings
        SET
          enable_customer_recommendation = COALESCE($1, enable_customer_recommendation),
          enable_table_management = COALESCE($2, enable_table_management),
          enable_refund = COALESCE($3, enable_refund),
          enable_void = COALESCE($4, enable_void),
          enable_discount = COALESCE($5, enable_discount),
          enable_service_charge = COALESCE($6, enable_service_charge),
          service_charge_rate = COALESCE($7, service_charge_rate),
          service_charge_percentage = COALESCE($7, service_charge_percentage),
          enable_tax = COALESCE($8, enable_tax),
          tax_rate = COALESCE($9, tax_rate),
          enable_dine_in = COALESCE($10, enable_dine_in),
          enable_takeout = COALESCE($11, enable_takeout),
          enable_ingredient_customization = COALESCE($12, enable_ingredient_customization),
          enable_receipt_printing = COALESCE($13, enable_receipt_printing),
          enabled_payment_methods = COALESCE($14, enabled_payment_methods),
          store_type = COALESCE(store_type, $15),
          updated_at = CURRENT_TIMESTAMP
        WHERE store_id = $16
          AND (store_type = $15 OR store_type IS NULL)
        RETURNING *
      `,
      [
        input.enableCustomerRecommendation,
        input.enableTableManagement,
        input.enableRefund,
        input.enableVoid,
        input.enableDiscount,
        input.enableServiceCharge,
        input.serviceChargeRate,
        input.enableTax,
        input.taxRate,
        input.enableDineIn,
        input.enableTakeout,
        input.enableIngredientCustomization,
        input.enableReceiptPrinting,
        input.enabledPaymentMethods ?? null,
        admin.store_type,
        admin.store_id,
      ],
    );

    return rows[0];
  }

  async listDiscountSettingsForAdmin(adminUserId: number) {
    const admin = await this.getUserStoreScope(adminUserId);

    if (!admin.store_id) {
      throw new InternalServerErrorException('Only store-linked accounts can view discount settings.');
    }

    await this.ensureDefaultDiscountSettings(admin.store_id);

    return this.query(
      `
        SELECT id, store_id, discount_name, discount_rate, is_enabled, created_at, updated_at
        FROM discount_settings
        WHERE store_id = $1
        ORDER BY id ASC
      `,
      [admin.store_id],
    );
  }

  async createDiscountSettingForAdmin(input: { adminUserId: number; discountName: string; discountRate: number; isEnabled: boolean }) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can create discount settings.');
    }

    const rows = await this.query(
      `
        INSERT INTO discount_settings (store_id, discount_name, discount_rate, is_enabled)
        VALUES ($1, $2, $3, $4)
        RETURNING id, store_id, discount_name, discount_rate, is_enabled, created_at, updated_at
      `,
      [admin.store_id, input.discountName, input.discountRate, input.isEnabled],
    );

    return rows[0];
  }

  async updateDiscountSettingForAdmin(input: { adminUserId: number; discountId: number; discountName: string; discountRate: number; isEnabled: boolean }) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can update discount settings.');
    }

    const rows = await this.query(
      `
        UPDATE discount_settings
        SET discount_name = $1,
            discount_rate = $2,
            is_enabled = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
          AND store_id = $5
        RETURNING id, store_id, discount_name, discount_rate, is_enabled, created_at, updated_at
      `,
      [input.discountName, input.discountRate, input.isEnabled, input.discountId, admin.store_id],
    );

    if (rows.length === 0) {
      throw new NotFoundException('Discount setting was not found for this store.');
    }

    return rows[0];
  }

  async deleteDiscountSettingForAdmin(input: { adminUserId: number; discountId: number }) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can delete discount settings.');
    }

    const rows = await this.query(
      `
        DELETE FROM discount_settings
        WHERE id = $1
          AND store_id = $2
        RETURNING id
      `,
      [input.discountId, admin.store_id],
    );

    if (rows.length === 0) {
      throw new NotFoundException('Discount setting was not found for this store.');
    }

    return { id: input.discountId };
  }

  async listCategoriesForAdmin(adminUserId: number) {
    const admin = await this.getUserStoreScope(adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can view categories.');
    }

    return this.query(
      `
        SELECT id, store_id, store_type, name, description, created_at, updated_at
        FROM product_categories
        WHERE store_id = $1
          AND store_type = $2
        ORDER BY name ASC
      `,
      [admin.store_id, admin.store_type],
    );
  }

  async createCategoryForAdmin(input: { adminUserId: number; name: string; description: string | null }) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id || !admin.store_type) {
      throw new InternalServerErrorException('Only store admin accounts can create categories.');
    }

    const rows = await this.query(
      `
        INSERT INTO product_categories (store_id, store_type, name, description)
        VALUES ($1, $2, $3, $4)
        RETURNING id, store_id, store_type, name, description, created_at, updated_at
      `,
      [admin.store_id, admin.store_type, input.name, input.description],
    );

    return rows[0];
  }

  async updateCategoryForAdmin(input: { adminUserId: number; categoryId: number; name: string; description: string | null }) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can update categories.');
    }

    const rows = await this.query(
      `
        UPDATE product_categories
        SET name = $1,
            description = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
          AND store_id = $4
        RETURNING id, store_id, store_type, name, description, created_at, updated_at
      `,
      [input.name, input.description, input.categoryId, admin.store_id],
    );

    if (rows.length === 0) {
      throw new InternalServerErrorException('Category was not found for this store.');
    }

    return rows[0];
  }

  async deleteCategoryForAdmin(input: { adminUserId: number; categoryId: number }) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can delete categories.');
    }

    const rows = await this.query<{ id: number }>(
      `
        DELETE FROM product_categories
        WHERE id = $1
          AND store_id = $2
        RETURNING id
      `,
      [input.categoryId, admin.store_id],
    );

    return { id: rows[0]?.id ?? input.categoryId, deleted: rows.length > 0 };
  }

  async listProductsForAdmin(adminUserId: number) {
    const admin = await this.getUserStoreScope(adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can view products.');
    }

    const products = await this.query<any>(
      `
        SELECT
          p.*,
          c.name AS category_name,
          CASE
            WHEN p.store_type = 'RESTAURANT' THEN COALESCE(availability.available_quantity, 0)
            ELSE COALESCE(variant_summary.stock_quantity, p.stock_quantity, 0)
          END AS available_quantity,
          variant_summary.min_price
        FROM products p
        LEFT JOIN product_categories c ON c.id = p.category_id
        LEFT JOIN LATERAL (
          SELECT
            SUM(COALESCE(pv.stock_quantity, 0)) AS stock_quantity,
            MIN(pv.price) AS min_price
          FROM product_variants pv
          WHERE pv.product_id = p.id
            AND COALESCE(pv.is_active, TRUE) = TRUE
        ) variant_summary ON TRUE
        LEFT JOIN LATERAL (
          SELECT MIN(FLOOR(ii.quantity_available / NULLIF(pi.quantity_required, 0))) AS available_quantity
          FROM product_ingredients pi
          JOIN ingredients_inventory ii ON ii.id = pi.ingredient_id
          WHERE pi.product_id = p.id
            AND pi.is_required = TRUE
            AND COALESCE(ii.is_available, TRUE) = TRUE
        ) availability ON TRUE
        WHERE p.store_id = $1
          AND p.store_type = $2
        ORDER BY p.created_at DESC
      `,
      [admin.store_id, admin.store_type],
    );

    if (admin.store_type !== 'RETAIL_STORE' || products.length === 0) {
      return products;
    }

    const variants = await this.query<any>(
      `
        SELECT pv.*
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE p.store_id = $1
          AND p.store_type = 'RETAIL_STORE'
        ORDER BY pv.id ASC
      `,
      [admin.store_id],
    );

    const variantsByProduct = new Map<number, any[]>();
    for (const variant of variants) {
      const list = variantsByProduct.get(Number(variant.product_id)) ?? [];
      list.push(variant);
      variantsByProduct.set(Number(variant.product_id), list);
    }

    return products.map((product) => ({
      ...product,
      price: product.min_price ?? product.price,
      stock_quantity: product.available_quantity,
      variants: variantsByProduct.get(Number(product.id)) ?? [],
    }));
  }

  async createProductForAdmin(input: any) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id || !admin.store_type) {
      throw new InternalServerErrorException('Only store admin accounts can create products.');
    }

    const product = await this.withTransaction(async (client) => {
      const rows = await this.queryWithClient(
        client,
      `
        INSERT INTO products (
          store_id, category_id, store_type, name, description, price, image_url,
          meal_type, preparation_time_minutes, sku, barcode, unit, size, color,
          stock_quantity, low_stock_limit, is_available, brand, material
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, COALESCE($17, TRUE), $18, $19)
        RETURNING *
      `,
      [
        admin.store_id,
        input.categoryId,
        admin.store_type,
        input.name,
        input.description ?? null,
        admin.store_type === 'RETAIL_STORE' ? 0 : input.price,
        input.image_url ?? null,
        input.meal_type ?? null,
        input.preparation_time_minutes ?? null,
        input.sku ?? null,
        input.barcode ?? null,
        input.unit ?? null,
        input.size ?? null,
        input.color ?? null,
        input.stock_quantity ?? 0,
        input.low_stock_limit ?? 5,
        input.is_available,
        input.brand ?? null,
        input.material ?? null,
      ],
      );

      if (admin.store_type === 'RETAIL_STORE') {
        await this.replaceProductVariants(client, rows[0].id, input.variants ?? []);
      } else {
        await this.replaceProductIngredients(client, admin.store_id!, rows[0].id, input.ingredients ?? []);
      }
      return rows[0];
    });

    return product;
  }

  async updateProductForAdmin(input: any) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can update products.');
    }

    const product = await this.withTransaction(async (client) => {
      const rows = await this.queryWithClient(
        client,
      `
        UPDATE products
        SET
          category_id = $1,
          name = $2,
          description = $3,
          price = $4,
          image_url = $5,
          meal_type = $6,
          preparation_time_minutes = $7,
          sku = $8,
          barcode = $9,
          unit = $10,
          size = $11,
          color = $12,
          stock_quantity = $13,
          low_stock_limit = $14,
          is_available = COALESCE($15, is_available),
          brand = $16,
          material = $17,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $18
          AND store_id = $19
        RETURNING *
      `,
      [
        input.categoryId,
        input.name,
        input.description ?? null,
        admin.store_type === 'RETAIL_STORE' ? 0 : input.price,
        input.image_url ?? null,
        input.meal_type ?? null,
        input.preparation_time_minutes ?? null,
        input.sku ?? null,
        input.barcode ?? null,
        input.unit ?? null,
        input.size ?? null,
        input.color ?? null,
        input.stock_quantity ?? 0,
        input.low_stock_limit ?? 5,
        input.is_available,
        input.brand ?? null,
        input.material ?? null,
        input.productId,
        admin.store_id,
      ],
      );

      if (rows.length === 0) {
        throw new InternalServerErrorException('Product was not found for this store.');
      }

      if (admin.store_type === 'RETAIL_STORE' && Array.isArray(input.variants)) {
        await this.replaceProductVariants(client, input.productId, input.variants);
      } else if (Array.isArray(input.ingredients)) {
        await this.replaceProductIngredients(client, admin.store_id!, input.productId, input.ingredients);
      }

      return rows[0];
    });

    return product;
  }

  async deleteProductForAdmin(input: { adminUserId: number; productId: number }) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can delete products.');
    }

    const rows = await this.query<{ id: number }>(
      `
        DELETE FROM products
        WHERE id = $1
          AND store_id = $2
        RETURNING id
      `,
      [input.productId, admin.store_id],
    );

    return { id: rows[0]?.id ?? input.productId, deleted: rows.length > 0 };
  }

  async listIngredientsForAdmin(adminUserId: number) {
    const admin = await this.getUserStoreScope(adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can view ingredients.');
    }

    return this.query(
      `
        SELECT *
        FROM ingredients_inventory
        WHERE store_id = $1
        ORDER BY ingredient_name ASC
      `,
      [admin.store_id],
    );
  }

  async createIngredientForAdmin(input: any) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can create ingredients.');
    }

    const rows = await this.query(
      `
        INSERT INTO ingredients_inventory (
          store_id, ingredient_name, quantity_available, unit, low_stock_limit, cost_per_unit, is_available
        )
        VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, TRUE))
        RETURNING *
      `,
      [
        admin.store_id,
        input.ingredientName,
        input.quantityAvailable ?? 0,
        input.unit,
        input.lowStockLimit ?? 0,
        input.costPerUnit ?? 0,
        input.isAvailable,
      ],
    );

    return rows[0];
  }

  async updateIngredientForAdmin(input: any) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can update ingredients.');
    }

    const rows = await this.query(
      `
        UPDATE ingredients_inventory
        SET ingredient_name = $1,
            quantity_available = $2,
            unit = $3,
            low_stock_limit = $4,
            cost_per_unit = $5,
            is_available = COALESCE($6, is_available),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
          AND store_id = $8
        RETURNING *
      `,
      [
        input.ingredientName,
        input.quantityAvailable ?? 0,
        input.unit,
        input.lowStockLimit ?? 0,
        input.costPerUnit ?? 0,
        input.isAvailable,
        input.ingredientId,
        admin.store_id,
      ],
    );

    if (rows.length === 0) {
      throw new InternalServerErrorException('Ingredient was not found for this store.');
    }

    return rows[0];
  }

  async deleteIngredientForAdmin(input: { adminUserId: number; ingredientId: number }) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can delete ingredients.');
    }

    const rows = await this.query<{ id: number }>(
      `
        DELETE FROM ingredients_inventory
        WHERE id = $1
          AND store_id = $2
        RETURNING id
      `,
      [input.ingredientId, admin.store_id],
    );

    return { id: rows[0]?.id ?? input.ingredientId, deleted: rows.length > 0 };
  }

  async listIngredientAlternativesForAdmin(adminUserId: number) {
    const admin = await this.getUserStoreScope(adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can view ingredient alternatives.');
    }

    return this.query(
      `
        SELECT
          ia.id,
          ia.store_id,
          ia.parent_ingredient_id,
          parent.ingredient_name AS parent_ingredient_name,
          ia.alternative_ingredient_id,
          alternative.ingredient_name AS alternative_ingredient_name,
          alternative.quantity_available AS alternative_quantity_available,
          alternative.unit AS alternative_unit,
          ia.additional_price,
          ia.is_available,
          ia.created_at,
          ia.updated_at
        FROM ingredient_alternatives ia
        JOIN ingredients_inventory parent ON parent.id = ia.parent_ingredient_id
        JOIN ingredients_inventory alternative ON alternative.id = ia.alternative_ingredient_id
        WHERE ia.store_id = $1
        ORDER BY parent.ingredient_name ASC, alternative.ingredient_name ASC
      `,
      [admin.store_id],
    );
  }

  async createIngredientAlternativeForAdmin(input: any) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can create ingredient alternatives.');
    }

    if (Number(input.parentIngredientId) === Number(input.alternativeIngredientId)) {
      throw new BadRequestException('Alternative ingredient must be different from the parent ingredient.');
    }

    const ingredientRows = await this.query<{ id: number; ingredient_name: string }>(
      `
        SELECT id, ingredient_name
        FROM ingredients_inventory
        WHERE store_id = $1
          AND id IN ($2, $3)
      `,
      [admin.store_id, input.parentIngredientId, input.alternativeIngredientId],
    );

    if (ingredientRows.length !== 2) {
      throw new NotFoundException('Both parent and alternative ingredients must exist in this store inventory.');
    }

    const alternative = ingredientRows.find((row) => Number(row.id) === Number(input.alternativeIngredientId));
    const rows = await this.query(
      `
        INSERT INTO ingredient_alternatives (
          store_id, parent_ingredient_id, alternative_ingredient_id, alternative_name,
          additional_price, is_available
        )
        VALUES ($1, $2, $3, $4, $5, COALESCE($6, TRUE))
        RETURNING *
      `,
      [
        admin.store_id,
        input.parentIngredientId,
        input.alternativeIngredientId,
        alternative?.ingredient_name ?? 'Alternative',
        input.additionalPrice ?? 0,
        input.isAvailable,
      ],
    );

    return rows[0];
  }

  async updateIngredientAlternativeForAdmin(input: any) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can update ingredient alternatives.');
    }

    if (Number(input.parentIngredientId) === Number(input.alternativeIngredientId)) {
      throw new BadRequestException('Alternative ingredient must be different from the parent ingredient.');
    }

    const ingredientRows = await this.query<{ id: number; ingredient_name: string }>(
      `
        SELECT id, ingredient_name
        FROM ingredients_inventory
        WHERE store_id = $1
          AND id IN ($2, $3)
      `,
      [admin.store_id, input.parentIngredientId, input.alternativeIngredientId],
    );

    if (ingredientRows.length !== 2) {
      throw new NotFoundException('Both parent and alternative ingredients must exist in this store inventory.');
    }

    const alternative = ingredientRows.find((row) => Number(row.id) === Number(input.alternativeIngredientId));
    const rows = await this.query(
      `
        UPDATE ingredient_alternatives
        SET parent_ingredient_id = $1,
            alternative_ingredient_id = $2,
            alternative_name = $3,
            additional_price = $4,
            is_available = COALESCE($5, is_available),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
          AND store_id = $7
        RETURNING *
      `,
      [
        input.parentIngredientId,
        input.alternativeIngredientId,
        alternative?.ingredient_name ?? 'Alternative',
        input.additionalPrice ?? 0,
        input.isAvailable,
        input.alternativeId,
        admin.store_id,
      ],
    );

    if (rows.length === 0) {
      throw new NotFoundException('Ingredient alternative was not found for this store.');
    }

    return rows[0];
  }

  async deleteIngredientAlternativeForAdmin(input: { adminUserId: number; alternativeId: number }) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can delete ingredient alternatives.');
    }

    const rows = await this.query<{ id: number }>(
      `
        DELETE FROM ingredient_alternatives
        WHERE id = $1
          AND store_id = $2
        RETURNING id
      `,
      [input.alternativeId, admin.store_id],
    );

    return { id: rows[0]?.id ?? input.alternativeId, deleted: rows.length > 0 };
  }

  async listInventoryDeductionsForAdmin(adminUserId: number) {
    const admin = await this.getUserStoreScope(adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can view inventory history.');
    }

    return this.query(
      `
        SELECT
          d.id,
          d.store_id,
          d.order_id,
          o.order_number,
          d.order_item_id,
          oi.product_name AS order_item_name,
          d.ingredient_id,
          ii.ingredient_name,
          d.product_id,
          d.variant_id,
          CASE
            WHEN pv.id IS NOT NULL THEN CONCAT(p.name, ' - ', COALESCE(pv.size, 'No size'), ' / ', COALESCE(pv.color, 'No color'))
            ELSE p.name
          END AS product_name,
          d.deduction_type,
          d.quantity_deducted,
          d.unit,
          d.created_at
        FROM inventory_deductions d
        LEFT JOIN orders o ON o.id = d.order_id
        LEFT JOIN order_items oi ON oi.id = d.order_item_id
        LEFT JOIN ingredients_inventory ii ON ii.id = d.ingredient_id
        LEFT JOIN products p ON p.id = d.product_id
        LEFT JOIN product_variants pv ON pv.id = d.variant_id
        WHERE d.store_id = $1
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT 200
      `,
      [admin.store_id],
    );
  }

  async listProductIngredientsForAdmin(input: { adminUserId: number; productId: number }) {
    const admin = await this.getUserStoreScope(input.adminUserId);

    if (admin.role !== 'ADMIN' || !admin.store_id) {
      throw new InternalServerErrorException('Only store admin accounts can view product ingredients.');
    }

    return this.query(
      `
        SELECT
          pi.*,
          ii.ingredient_name,
          ii.quantity_available,
          ii.low_stock_limit
        FROM product_ingredients pi
        LEFT JOIN ingredients_inventory ii ON ii.id = pi.ingredient_id
        WHERE pi.store_id = $1
          AND pi.product_id = $2
        ORDER BY pi.id ASC
      `,
      [admin.store_id, input.productId],
    );
  }

  async listPosProducts(userId: number) {
    const user = await this.getUserStoreScope(userId);

    if (!user.store_id || !user.store_type) {
      throw new InternalServerErrorException('User account is not linked to a store.');
    }

    if (user.store_type === 'RETAIL_STORE') {
      return this.query<any>(
        `
          SELECT
            p.id,
            pv.id AS variant_id,
            p.store_id,
            p.store_type,
            p.category_id,
            p.name,
            p.description,
            p.brand,
            p.material,
            COALESCE(pv.image_url, p.image_url) AS image_url,
            p.is_available,
            c.name AS category_name,
            pv.size,
            pv.color,
            pv.sku,
            pv.barcode,
            pv.price,
            pv.stock_quantity,
            pv.low_stock_limit,
            pv.is_active,
            pv.stock_quantity AS available_quantity
          FROM products p
          JOIN product_variants pv ON pv.product_id = p.id
          LEFT JOIN product_categories c ON c.id = p.category_id
          WHERE p.store_id = $1
            AND p.store_type = 'RETAIL_STORE'
            AND COALESCE(p.is_available, TRUE) = TRUE
            AND COALESCE(pv.is_active, TRUE) = TRUE
          ORDER BY p.name ASC, pv.color ASC NULLS LAST, pv.size ASC NULLS LAST
        `,
        [user.store_id],
      );
    }

    const products = await this.query<any>(
      `
        SELECT
          p.*,
          c.name AS category_name,
          CASE
            WHEN p.store_type = 'RESTAURANT' THEN COALESCE(availability.available_quantity, 0)
            ELSE COALESCE(p.stock_quantity, 0)
          END AS available_quantity
        FROM products p
        LEFT JOIN product_categories c ON c.id = p.category_id
        LEFT JOIN LATERAL (
          SELECT MIN(FLOOR(ii.quantity_available / NULLIF(pi.quantity_required, 0))) AS available_quantity
          FROM product_ingredients pi
          JOIN ingredients_inventory ii ON ii.id = pi.ingredient_id
          WHERE pi.product_id = p.id
            AND pi.is_required = TRUE
            AND COALESCE(ii.is_available, TRUE) = TRUE
        ) availability ON TRUE
        WHERE p.store_id = $1
          AND p.store_type = $2
          AND COALESCE(p.is_available, TRUE) = TRUE
        ORDER BY p.name ASC
      `,
      [user.store_id, user.store_type],
    );

    const ingredientRows = user.store_type === 'RESTAURANT'
      ? await this.query<any>(
          `
            SELECT
              pi.id,
              pi.product_id,
              pi.ingredient_id,
              COALESCE(ii.ingredient_name, pi.ingredient_name) AS name,
              pi.quantity_required AS quantity,
              pi.unit,
              pi.additional_cost,
              pi.is_required,
              pi.is_removable,
              ii.quantity_available,
              COALESCE(ii.is_available, TRUE) AS is_available
            FROM product_ingredients pi
            LEFT JOIN ingredients_inventory ii ON ii.id = pi.ingredient_id
            WHERE pi.store_id = $1
            ORDER BY pi.id ASC
          `,
          [user.store_id],
        )
      : [];

    const alternatives = user.store_type === 'RESTAURANT'
      ? await this.query<any>(
          `
            SELECT
              ia.*,
              ii.ingredient_name,
              ii.quantity_available,
              ii.unit
            FROM ingredient_alternatives ia
            JOIN ingredients_inventory ii ON ii.id = ia.alternative_ingredient_id
            WHERE ia.store_id = $1
              AND COALESCE(ia.is_available, TRUE) = TRUE
              AND COALESCE(ii.is_available, TRUE) = TRUE
              AND ii.quantity_available > 0
            ORDER BY ii.ingredient_name ASC
          `,
          [user.store_id],
        )
      : [];

    const alternativesByParent = new Map<number, any[]>();
    for (const alternative of alternatives) {
      const list = alternativesByParent.get(Number(alternative.parent_ingredient_id)) ?? [];
      list.push(alternative);
      alternativesByParent.set(Number(alternative.parent_ingredient_id), list);
    }

    const ingredientsByProduct = new Map<number, any[]>();
    for (const ingredient of ingredientRows) {
      const list = ingredientsByProduct.get(Number(ingredient.product_id)) ?? [];
      list.push({
        ...ingredient,
        alternatives: alternativesByParent.get(Number(ingredient.ingredient_id)) ?? [],
      });
      ingredientsByProduct.set(Number(ingredient.product_id), list);
    }

    return products.map((product) => ({
      ...product,
      ingredients: ingredientsByProduct.get(Number(product.id)) ?? [],
    }));
  }

  async createPaidPosOrder(input: any) {
    await this.ensurePosOrderSchema();
    const user = await this.getUserStoreScope(input.userId);

    if (!user.store_id || !user.store_type) {
      throw new InternalServerErrorException('User account is not linked to a store.');
    }

    try {
      return await this.withTransaction(async (client) => {
        const isPaid = Boolean(input.payment);
        const orderStatus = input.orderStatus ?? (isPaid ? 'COMPLETED' : 'PENDING');
        const paymentStatus = input.paymentStatus ?? (isPaid ? 'PAID' : 'NOT_PAID');
        const orderNumber = await this.createUniqueOrderNumber(client, input.orderNumber);
        const partySize = Number(input.partySize ?? input.party_size ?? input.requiredSeats ?? 0);
        const orderRows = await this.queryWithClient<{ id: number }>(
          client,
          `
            INSERT INTO orders (
              store_id, cashier_id, order_number, customer_name, order_type, table_name,
              party_size, subtotal, discount_amount, discount_type, tax_amount, service_charge,
              total_amount, order_status, payment_status, completed_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING id
          `,
          [
            user.store_id,
            user.id,
            orderNumber,
            input.customerName ?? null,
            input.orderType ?? (user.store_type === 'RETAIL_STORE' ? 'RETAIL' : 'TAKEOUT'),
            input.tableName ?? null,
            Number.isFinite(partySize) && partySize > 0 ? partySize : null,
            input.subtotal ?? 0,
            input.discount ?? 0,
            input.discountType ?? null,
            input.tax ?? 0,
            input.serviceFee ?? 0,
            input.total ?? 0,
            orderStatus,
            paymentStatus,
            isPaid ? new Date() : null,
          ],
        );
        const orderId = orderRows[0].id;

      for (const item of input.items ?? []) {
        const itemRows = await this.queryWithClient<{ id: number }>(
          client,
          `
            INSERT INTO order_items (
              order_id, product_id, variant_id, product_name, category_name, size, color,
              quantity, unit_price, line_total, item_type, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
          `,
          [
            orderId,
            item.productId ?? item.id ?? null,
            item.variantId ?? item.variant_id ?? null,
            item.name,
            item.categoryName ?? item.category ?? null,
            item.size ?? null,
            item.color ?? null,
            item.quantity ?? 1,
            item.price ?? 0,
            (item.price ?? 0) * (item.quantity ?? 1),
            item.orderType ?? null,
            item.notes ?? null,
          ],
        );
        const orderItemId = itemRows[0].id;

        if (user.store_type === 'RETAIL_STORE') {
          await this.deductRetailProduct(client, user.store_id!, orderId, orderItemId, item.productId ?? item.id, item.variantId ?? item.variant_id, item.quantity ?? 1);
        } else {
          await this.deductRestaurantIngredients(client, user.store_id!, orderId, orderItemId, item);
        }
      }

      if (input.payment) {
        const paymentNumber = await this.createUniquePaymentNumber(client, `PAY-${orderNumber}`);

        await this.queryWithClient(
          client,
          `
            INSERT INTO payments (
              store_id, order_id, processed_by, payment_number, payment_method,
              amount_due, amount_paid, change_amount, payment_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PAID')
          `,
          [
            user.store_id,
            orderId,
            user.id,
            paymentNumber,
            input.payment.method ?? 'Cash',
            input.total ?? 0,
            input.payment.amountPaid ?? input.total ?? 0,
            input.payment.changeAmount ?? 0,
          ],
        );
      }

        return { id: orderId, order_number: orderNumber };
      });
    } catch (error) {
      this.handleDatabaseWriteError(error, 'Unable to save order.');
    }
  }

  async getNextPosOrderNumber(userId: number) {
    const user = await this.getUserStoreScope(userId);

    if (!user.store_id || !user.store_type) {
      throw new InternalServerErrorException('User account is not linked to a store.');
    }

    const rows = await this.query<{ next_order_number: string | number }>(
      `
        SELECT COALESCE(MAX(NULLIF(regexp_replace(order_number, '\\D', '', 'g'), '')::BIGINT), 100000) + 1 AS next_order_number
        FROM orders
      `,
    );

    return { order_number: String(rows[0]?.next_order_number ?? 100001).padStart(6, '0') };
  }

  async updatePosOrder(input: any) {
    await this.ensurePosOrderSchema();
    const user = await this.getUserStoreScope(input.userId);

    if (!user.store_id || !user.store_type) {
      throw new InternalServerErrorException('User account is not linked to a store.');
    }

    const updates: string[] = [];
    const values: any[] = [user.store_id, input.orderNumber];

    const addUpdate = (column: string, value: any) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    if (input.tableName !== undefined) addUpdate('table_name', input.tableName);
    const isPaymentUpdate = Boolean(input.payment);
    if (input.orderStatus !== undefined) addUpdate('order_status', input.orderStatus);
    if (input.paymentStatus !== undefined) addUpdate('payment_status', input.paymentStatus);
    if (isPaymentUpdate && input.paymentStatus === undefined) addUpdate('payment_status', 'PAID');
    if (input.orderStatus === 'COMPLETED') addUpdate('completed_at', new Date());

    if (updates.length === 0 && !isPaymentUpdate) {
      throw new BadRequestException('No order updates were provided.');
    }

    const rows = await this.withTransaction(async (client) => {
      const updatedRows = updates.length > 0
        ? await this.queryWithClient<{ id: number; order_number: string; total_amount: string | number }>(
            client,
            `
              UPDATE orders
              SET ${updates.join(', ')}
              WHERE store_id = $1
                AND order_number = $2
                AND (
                  ($${values.length + 1} = 'RETAIL_STORE' AND order_type = 'RETAIL')
                  OR ($${values.length + 1} = 'RESTAURANT' AND order_type <> 'RETAIL')
                )
              RETURNING id, order_number, total_amount
            `,
            [...values, user.store_type],
          )
        : await this.queryWithClient<{ id: number; order_number: string; total_amount: string | number }>(
            client,
            `
              SELECT id, order_number, total_amount
              FROM orders
              WHERE store_id = $1
                AND order_number = $2
                AND (
                  ($3 = 'RETAIL_STORE' AND order_type = 'RETAIL')
                  OR ($3 = 'RESTAURANT' AND order_type <> 'RETAIL')
                )
              LIMIT 1
            `,
            [user.store_id, input.orderNumber, user.store_type],
          );

      if (updatedRows.length === 0) {
        return updatedRows;
      }

      if (isPaymentUpdate) {
        const order = updatedRows[0];
        const paymentNumber = await this.createUniquePaymentNumber(client, input.payment.paymentNumber ?? `PAY-${order.order_number}`);
        await this.queryWithClient(
          client,
          `
            INSERT INTO payments (
              store_id, order_id, processed_by, payment_number, payment_method,
              amount_due, amount_paid, change_amount, payment_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PAID')
          `,
          [
            user.store_id,
            order.id,
            user.id,
            paymentNumber,
            input.payment.method ?? 'Cash',
            Number(order.total_amount ?? 0),
            input.payment.amountPaid ?? Number(order.total_amount ?? 0),
            input.payment.changeAmount ?? 0,
          ],
        );
      }

      return updatedRows;
    });

    if (rows.length === 0) {
      throw new NotFoundException('Order not found.');
    }

    return rows[0];
  }

  async listPosOrders(userId: number) {
    await this.ensurePosOrderSchema();
    const user = await this.getUserStoreScope(userId);

    if (!user.store_id || !user.store_type) {
      throw new InternalServerErrorException('User account is not linked to a store.');
    }

    return this.query<any>(
      `
        SELECT
          o.id,
          o.order_number,
          o.customer_name,
          o.order_type,
          o.table_name,
          o.party_size,
          o.subtotal,
          o.discount_amount,
          o.discount_type,
          o.tax_amount,
          o.service_charge,
          o.total_amount,
          o.order_status,
          o.payment_status,
          o.created_at,
          o.completed_at,
          p.payment_number,
          p.payment_method,
          p.amount_paid,
          p.change_amount,
          COALESCE(payment_user.full_name, cashier_user.full_name) AS cashier_name,
          COALESCE(
            json_agg(
              json_build_object(
                'id', oi.id,
                'product_id', oi.product_id,
                'variant_id', oi.variant_id,
                'product_name', oi.product_name,
                'category_name', oi.category_name,
                'size', oi.size,
                'color', oi.color,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'line_total', oi.line_total,
                'image_url', COALESCE(pv.image_url, prod.image_url),
                'item_type', oi.item_type,
                'notes', oi.notes
              )
              ORDER BY oi.id ASC
            ) FILTER (WHERE oi.id IS NOT NULL),
            '[]'::json
          ) AS items
        FROM orders o
        LEFT JOIN payments p ON p.order_id = o.id
        LEFT JOIN users cashier_user ON cashier_user.id = o.cashier_id
        LEFT JOIN users payment_user ON payment_user.id = p.processed_by
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN products prod ON prod.id = oi.product_id
        LEFT JOIN product_variants pv ON pv.id = oi.variant_id
        WHERE o.store_id = $1
          AND (
            ($2 = 'RETAIL_STORE' AND o.order_type = 'RETAIL')
            OR ($2 = 'RESTAURANT' AND o.order_type <> 'RETAIL')
          )
        GROUP BY o.id, p.payment_number, p.payment_method, p.amount_paid, p.change_amount, cashier_user.full_name, payment_user.full_name
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT 500
      `,
      [user.store_id, user.store_type],
    );
  }

  private async replaceProductIngredients(client: PoolClient, storeId: number, productId: number, ingredients: any[]) {
    await this.queryWithClient(
      client,
      `
        DELETE FROM product_ingredients
        WHERE store_id = $1
          AND product_id = $2
      `,
      [storeId, productId],
    );

    for (const ingredient of ingredients) {
      if (!ingredient.ingredient_id && !ingredient.ingredientId) {
        continue;
      }

      const inventoryRows = await this.queryWithClient<any>(
        client,
        `
          SELECT ingredient_name, unit
          FROM ingredients_inventory
          WHERE id = $1
            AND store_id = $2
          LIMIT 1
        `,
        [ingredient.ingredient_id ?? ingredient.ingredientId, storeId],
      );

      const inventory = inventoryRows[0];
      if (!inventory) {
        continue;
      }

      const quantity = Number(ingredient.quantity_required ?? ingredient.quantityRequired ?? ingredient.default_quantity ?? 0);

      await this.queryWithClient(
        client,
        `
          INSERT INTO product_ingredients (
            store_id, product_id, ingredient_id, ingredient_name, quantity_required,
            default_quantity, unit, additional_cost, is_required, is_removable
          )
          VALUES ($1, $2, $3, $4, $5, $5, $6, $7, COALESCE($8, TRUE), COALESCE($9, TRUE))
        `,
        [
          storeId,
          productId,
          ingredient.ingredient_id ?? ingredient.ingredientId,
          inventory.ingredient_name,
          quantity,
          ingredient.unit ?? inventory.unit,
          ingredient.additional_cost ?? ingredient.additionalCost ?? 0,
          ingredient.is_required ?? ingredient.isRequired,
          ingredient.is_removable ?? ingredient.isRemovable,
        ],
      );
    }
  }

  private async replaceProductVariants(client: PoolClient, productId: number, variants: any[]) {
    await this.queryWithClient(
      client,
      `
        DELETE FROM product_variants
        WHERE product_id = $1
      `,
      [productId],
    );

    for (const [index, variant] of variants.entries()) {
      const hasVariantValue = variant.size || variant.color || variant.image_url || variant.sku || variant.barcode || variant.price || variant.stock_quantity;
      if (!hasVariantValue) {
        continue;
      }

      const generatedCode = this.buildVariantCode(productId, index);

      await this.queryWithClient(
        client,
        `
          INSERT INTO product_variants (
            product_id, size, color, sku, barcode, image_url, price, stock_quantity, low_stock_limit, is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, TRUE))
        `,
        [
          productId,
          variant.size ?? null,
          variant.color ?? null,
          variant.sku || generatedCode,
          variant.barcode || generatedCode,
          variant.image_url ?? null,
          Number(variant.price ?? 0),
          Number(variant.stock_quantity ?? 0),
          Number(variant.low_stock_limit ?? 5),
          variant.is_active ?? true,
        ],
      );
    }
  }

  private buildVariantCode(productId: number, index: number) {
    return `${String(productId).padStart(8, '0')}${String(index + 1).padStart(4, '0')}`;
  }

  private async deductRetailProduct(client: PoolClient, storeId: number, orderId: number, orderItemId: number, productId: number, variantId: number, quantity: number) {
    const variantRows = await this.queryWithClient<{ stock_quantity: number; product_id: number; size: string | null; color: string | null; inventory_item_id: string | null }>(
      client,
      `
        SELECT pv.stock_quantity, pv.product_id, pv.size, pv.color
             , COALESCE(pv.inventory_item_id, p.inventory_item_id) AS inventory_item_id
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = $1
          AND p.id = $2
          AND p.store_id = $3
        FOR UPDATE
      `,
      [variantId, productId, storeId],
    );

    const variant = variantRows[0];
    if (!variant) {
      throw new NotFoundException('Product variant was not found for this store.');
    }

    if (Number(variant.stock_quantity ?? 0) < quantity) {
      throw new BadRequestException('Not enough variant stock for this order.');
    }

    await this.queryWithClient(
      client,
      `
        UPDATE product_variants
        SET stock_quantity = stock_quantity - $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `,
      [quantity, variantId],
    );

    if (variant.inventory_item_id) {
      await this.queryWithClient(
        client,
        `
          UPDATE "InventoryItem"
          SET quantity = GREATEST(quantity - $1, 0),
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = $2
        `,
        [quantity, variant.inventory_item_id],
      );
    }

    await this.queryWithClient(
      client,
      `
        INSERT INTO inventory_deductions (
          store_id, order_id, order_item_id, product_id, variant_id, deduction_type, quantity_deducted, unit
        )
        VALUES ($1, $2, $3, $4, $5, 'RETAIL_VARIANT_SALE', $6, $7)
      `,
      [storeId, orderId, orderItemId, productId, variantId, quantity, 'pcs'],
    );

    await this.queryWithClient(
      client,
      `
        INSERT INTO inventory_transactions (
          store_id, product_id, variant_id, transaction_type, quantity, remarks
        )
        VALUES ($1, $2, $3, 'SALE', $4, $5)
      `,
      [storeId, productId, variantId, quantity, `Order ${orderId}`],
    );
  }

  private async deductRestaurantIngredients(client: PoolClient, storeId: number, orderId: number, orderItemId: number, item: any) {
    const itemQuantity = Number(item.quantity ?? 1);
    const ingredients = Array.isArray(item.ingredients) ? item.ingredients : [];
    const finiteNumberOrNull = (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    };

    for (const ingredient of ingredients) {
      const originalId = finiteNumberOrNull(ingredient.ingredient_id ?? ingredient.ingredientId);
      const replacementId = finiteNumberOrNull(ingredient.replacement_ingredient_id ?? ingredient.replacementIngredientId);
      const productIngredientId = finiteNumberOrNull(ingredient.product_ingredient_id ?? ingredient.productIngredientId ?? (originalId ? ingredient.id : null));
      const ingredientId = replacementId ?? originalId;
      const removed = ingredient.removed === true || Number(ingredient.quantity ?? 0) <= 0;
      const quantity = removed ? 0 : Number(ingredient.quantity ?? ingredient.quantity_required ?? 0) * itemQuantity;
      const originalQuantity = Number(ingredient.original_quantity ?? ingredient.originalQuantity ?? ingredient.quantity ?? 0);
      const ingredientQuantity = Number(ingredient.quantity ?? 0);
      const additionalCost = Number(ingredient.additional_price ?? ingredient.additionalCost ?? 0);
      const customizationType = ingredient.customization_type ?? ingredient.customizationType ?? null;
      const hasCustomization = Boolean(
        customizationType ||
          removed ||
          replacementId ||
          additionalCost !== 0 ||
          (Number.isFinite(originalQuantity) && Number.isFinite(ingredientQuantity) && ingredientQuantity !== originalQuantity),
      );

      if (!ingredientId && !productIngredientId) {
        continue;
      }

      if (hasCustomization) {
        await this.queryWithClient(
          client,
          `
            INSERT INTO order_item_customizations (
              store_id, order_item_id, product_ingredient_id, original_ingredient_id,
              replacement_ingredient_id, customization_type, original_ingredient_name,
              replacement_ingredient_name, original_quantity, new_quantity, unit,
              additional_cost, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `,
          [
            storeId,
            orderItemId,
            productIngredientId,
            originalId,
            replacementId,
            customizationType ?? (removed ? 'REMOVE' : replacementId ? 'REPLACE' : 'CHANGE_QUANTITY'),
            ingredient.original_name ?? ingredient.name ?? null,
            ingredient.replacement_name ?? null,
            Number.isFinite(originalQuantity) ? originalQuantity : null,
            Number.isFinite(ingredientQuantity) ? ingredientQuantity : 0,
            ingredient.unit ?? null,
            additionalCost,
            ingredient.notes ?? null,
          ],
        );
      }

      if (quantity <= 0 || !ingredientId) {
        continue;
      }

      const inventoryRows = await this.queryWithClient<{ quantity_available: string | number; unit: string; inventory_item_id: string | null }>(
        client,
        `
          SELECT quantity_available, unit, inventory_item_id
          FROM ingredients_inventory
          WHERE id = $1
            AND store_id = $2
          FOR UPDATE
        `,
        [ingredientId, storeId],
      );

      const inventory = inventoryRows[0];
      if (!inventory) {
        throw new NotFoundException('Ingredient was not found for this store.');
      }

      if (Number(inventory.quantity_available ?? 0) < quantity) {
        throw new BadRequestException('Not enough ingredient inventory for this order.');
      }

      await this.queryWithClient(
        client,
        `
          UPDATE ingredients_inventory
          SET quantity_available = quantity_available - $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
            AND store_id = $3
        `,
        [quantity, ingredientId, storeId],
      );

      if (inventory.inventory_item_id) {
        await this.queryWithClient(
          client,
          `
            UPDATE "InventoryItem"
            SET quantity = GREATEST(quantity - $1, 0),
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $2
          `,
          [quantity, inventory.inventory_item_id],
        );
      }

      await this.queryWithClient(
        client,
        `
          INSERT INTO inventory_deductions (
            store_id, order_id, order_item_id, ingredient_id, product_id,
            deduction_type, quantity_deducted, unit
          )
          VALUES ($1, $2, $3, $4, $5, 'RESTAURANT_INGREDIENT_SALE', $6, $7)
        `,
        [storeId, orderId, orderItemId, ingredientId, item.productId ?? item.id ?? null, quantity, ingredient.unit ?? inventory.unit],
      );
    }
  }

  private async createUniqueOrderNumber(client: PoolClient, requestedOrderNumber: unknown) {
    await client.query('LOCK TABLE orders IN SHARE ROW EXCLUSIVE MODE');

    const requestedDigits = String(requestedOrderNumber ?? '').replace(/\D/g, '');
    const requestedNumeric = requestedDigits ? Number(requestedDigits) : null;
    const maxRows = await this.queryWithClient<{ max_order_number: string | number | null }>(
      client,
      `
        SELECT COALESCE(MAX(NULLIF(regexp_replace(order_number, '\\D', '', 'g'), '')::BIGINT), 100000) AS max_order_number
        FROM orders
      `,
    );
    const maxOrderNumber = Number(maxRows[0]?.max_order_number ?? 100000);
    let candidate = Math.max(
      Number.isFinite(requestedNumeric) && requestedNumeric ? requestedNumeric : 100001,
      Number.isFinite(maxOrderNumber) ? maxOrderNumber + 1 : 100001,
    );

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidateText = String(candidate).padStart(6, '0');
      const existing = await this.queryWithClient<{ id: number }>(
        client,
        `
          SELECT id
          FROM orders
          WHERE regexp_replace(order_number, '\\D', '', 'g') = $1
          LIMIT 1
        `,
        [candidateText],
      );

      if (existing.length === 0) {
        return candidateText;
      }

      candidate += 1;
    }

    return String(Date.now());
  }

  private async createUniquePaymentNumber(client: PoolClient, requestedPaymentNumber: unknown) {
    const basePaymentNumber = String(requestedPaymentNumber ?? '').trim() || `PAY-${Date.now()}`;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = attempt === 0 ? basePaymentNumber : `${basePaymentNumber}-${attempt + 1}`;
      const existing = await this.queryWithClient<{ id: number }>(
        client,
        `
          SELECT id
          FROM payments
          WHERE payment_number = $1
          LIMIT 1
        `,
        [candidate],
      );

      if (existing.length === 0) {
        return candidate;
      }
    }

    return `${basePaymentNumber}-${Date.now()}`;
  }

  private async ensureStoreInformationRow(storeId: number, fallbackStoreName: string | null, client?: PoolClient) {
    const sql = `
      INSERT INTO store_information (
        store_id,
        business_name,
        business_description,
        address,
        contact_number,
        email,
        receipt_thank_you_message,
        receipt_footer_message,
        operating_hours,
        currency,
        theme_color,
        tax_rate,
        service_charge_rate
      )
      SELECT
        $1,
        $2,
        'Your one-stop shop for quality ukay-ukay finds! We offer affordable and stylish pre-loved items for the whole family.',
        '123 Sampaguita St., Barangay Guadalupe, Cebu City, Cebu, Philippines',
        '0917 123 4567',
        'ukayhub.main@gmail.com',
        'Thank you for shopping with us!',
        'We appreciate your support. Come again!',
        'Mon-Sun, 9:00 AM - 8:00 PM',
        'PHP',
        '#008967',
        0,
        0
      WHERE NOT EXISTS (
        SELECT 1 FROM store_information WHERE store_id = $1
      )
    `;
    const params = [storeId, fallbackStoreName ?? 'Ukay Hub - Main Branch'];

    if (client) {
      await this.queryWithClient(client, sql, params);
      return;
    }

    await this.query(
      `
        ${sql}
      `,
      params,
    );
  }

  private async ensureStoreSettingsRow(storeId: number, storeType: string | null) {
    await this.ensureStoreSettingsSchema();

    await this.query(
      `
        INSERT INTO store_settings (
          store_id,
          store_type,
          enable_customer_recommendation,
          enable_table_management,
          enable_refund,
          enable_void,
          enable_discount,
          enable_service_charge,
          service_charge_rate,
          service_charge_percentage,
          enable_tax,
          tax_rate,
          enable_dine_in,
          enable_takeout,
          enable_ingredient_customization,
          enable_receipt_printing,
          enabled_payment_methods
        )
        VALUES ($1, $2, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 0, 0, TRUE, 0, TRUE, TRUE, TRUE, TRUE, ARRAY['Cash', 'GCash', 'Maya', 'Bank Transfer']::TEXT[])
        ON CONFLICT (store_id) DO UPDATE
        SET store_type = COALESCE(store_settings.store_type, EXCLUDED.store_type),
            service_charge_rate = COALESCE(store_settings.service_charge_rate, store_settings.service_charge_percentage, 0),
            service_charge_percentage = COALESCE(store_settings.service_charge_percentage, store_settings.service_charge_rate, 0),
            enabled_payment_methods = COALESCE(store_settings.enabled_payment_methods, EXCLUDED.enabled_payment_methods),
            updated_at = CURRENT_TIMESTAMP
      `,
      [storeId, storeType],
    );
  }

  private async ensureStoreSettingsSchema() {
    await this.query(
      `
        ALTER TABLE store_settings
          ADD COLUMN IF NOT EXISTS store_type VARCHAR(50),
          ADD COLUMN IF NOT EXISTS enable_customer_recommendation BOOLEAN DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS enable_table_management BOOLEAN DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS enable_refund BOOLEAN DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS enable_void BOOLEAN DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS enable_discount BOOLEAN DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS enable_service_charge BOOLEAN DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS service_charge_rate DECIMAL(5,2) DEFAULT 0,
          ADD COLUMN IF NOT EXISTS service_charge_percentage DECIMAL(5,2) DEFAULT 0,
          ADD COLUMN IF NOT EXISTS enable_tax BOOLEAN DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 0,
          ADD COLUMN IF NOT EXISTS enable_dine_in BOOLEAN DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS enable_takeout BOOLEAN DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS enable_ingredient_customization BOOLEAN DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS enable_receipt_printing BOOLEAN DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS enabled_payment_methods TEXT[] DEFAULT ARRAY['Cash', 'GCash', 'Maya', 'Bank Transfer'],
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `,
    );
  }

  private async ensurePosOrderSchema() {
    await this.query(
      `
        ALTER TABLE orders
          ADD COLUMN IF NOT EXISTS party_size INT
      `,
    );
  }

  private async ensureDefaultDiscountSettings(storeId: number) {
    await this.query(
      `
        INSERT INTO discount_settings (store_id, discount_name, discount_rate, is_enabled)
        SELECT $1, seed.discount_name, seed.discount_rate, TRUE
        FROM (
          VALUES
            ('PWD', 20),
            ('Senior Citizen', 20),
            ('Promo Discount', 10),
            ('Custom Discount', 0)
        ) AS seed(discount_name, discount_rate)
        WHERE NOT EXISTS (
          SELECT 1
          FROM discount_settings ds
          WHERE ds.store_id = $1
        )
      `,
      [storeId],
    );
  }

  private async getUserStoreScope(userId: number): Promise<AuthenticatedUser> {
    const schema = await this.getSchemaColumns();
    const userColumns = this.resolveUserColumns(schema.users);
    const storeColumns = this.resolveStoreColumns(schema.stores);

    if (!userColumns.fullNameColumn || !userColumns.roleColumn) {
      throw new InternalServerErrorException('Users table is missing required columns for store scoping.');
    }

    const storeJoin = userColumns.storeIdColumn && storeColumns.joinable ? `LEFT JOIN stores s ON s.id = u.${this.quoteIdentifier(userColumns.storeIdColumn)} LEFT JOIN store_information si ON si.store_id = s.id` : '';
    const storeTypeSelect = storeColumns.storeTypeColumn ? `${this.normalizedStoreTypeSql(`s.${this.quoteIdentifier(storeColumns.storeTypeColumn)}`)} AS store_type` : 'NULL AS store_type';
    const storeNameSelect = storeJoin
      ? storeColumns.storeNameColumn
        ? `COALESCE(si.business_name, s.${this.quoteIdentifier(storeColumns.storeNameColumn)}) AS store_name`
        : 'si.business_name AS store_name'
      : 'NULL AS store_name';

    const rows = await this.query<AuthenticatedUser>(
      `
        SELECT
          u.id,
          u.${this.quoteIdentifier(userColumns.fullNameColumn)} AS full_name,
          u.email,
          u.${this.quoteIdentifier(userColumns.roleColumn)} AS role,
          ${userColumns.storeIdColumn ? `u.${this.quoteIdentifier(userColumns.storeIdColumn)} AS store_id` : 'NULL AS store_id'},
          ${userColumns.staffTypeColumn ? `u.${this.quoteIdentifier(userColumns.staffTypeColumn)} AS staff_type` : 'NULL AS staff_type'},
          ${storeTypeSelect},
          ${storeNameSelect}
        FROM users u
        ${storeJoin}
        WHERE u.id = $1
        LIMIT 1
      `,
      [userId],
    );

    if (rows.length === 0) {
      throw new InternalServerErrorException('User account was not found.');
    }

    return rows[0];
  }

  private async getSchemaColumns(): Promise<SchemaColumns> {
    if (this.schemaColumns) {
      return this.schemaColumns;
    }

    const columns = await this.query<ColumnInfo & { table_name: string }>(
      `
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('users', 'stores')
      `,
    );
    const users = columns.filter((column) => column.table_name === 'users');
    const stores = columns.filter((column) => column.table_name === 'stores');

    this.schemaColumns = {
      users: new Set(users.map((column) => column.column_name.toLowerCase())),
      stores: new Set(stores.map((column) => column.column_name.toLowerCase())),
    };

    return this.schemaColumns;
  }

  private resolveUserColumns(columns: Set<string>) {
    const pick = (candidates: string[]) => candidates.find((candidate) => columns.has(candidate.toLowerCase())) ?? null;

    return {
      fullNameColumn: pick(['full_name', 'fullname', 'name']),
      roleColumn: pick(['role']),
      storeIdColumn: pick(['store_id']),
      staffTypeColumn: pick(['staff_type']),
      passwordColumn: pick(['hashed_password', 'password_hash', 'password']),
      statusColumn: pick(['status']),
    };
  }

  private activeUsersWhereClause(userColumns: { statusColumn: string | null }, alias = 'u') {
    if (!userColumns.statusColumn) {
      return '';
    }

    return ` AND COALESCE(${alias}.${this.quoteIdentifier(userColumns.statusColumn)}, 'ACTIVE') = 'ACTIVE'`;
  }

  private async deactivateAdminAndStoreStaff(
    adminUserId: number,
    storeId: number | null,
    userColumns: ReturnType<DatabaseService['resolveUserColumns']>,
  ) {
    if (!userColumns.statusColumn || !userColumns.roleColumn) {
      throw new InternalServerErrorException('Users table is missing required status columns.');
    }

    const statusColumn = this.quoteIdentifier(userColumns.statusColumn);
    const roleColumn = this.quoteIdentifier(userColumns.roleColumn);

    if (storeId && userColumns.storeIdColumn) {
      const storeIdColumn = this.quoteIdentifier(userColumns.storeIdColumn);
      const rows = await this.query<{ id: number }>(
        `
          UPDATE users
          SET ${statusColumn} = 'INACTIVE'
          WHERE (
            (id = $1 AND ${roleColumn} = 'ADMIN')
            OR (${roleColumn} = 'STAFF' AND ${storeIdColumn} = $2)
          )
          RETURNING id
        `,
        [adminUserId, storeId],
      );

      if (!rows.some((row) => Number(row.id) === adminUserId)) {
        throw new NotFoundException('Admin account was not found.');
      }

      return rows.map((row) => row.id);
    }

    const rows = await this.query<{ id: number }>(
      `
        UPDATE users
        SET ${statusColumn} = 'INACTIVE'
        WHERE id = $1
          AND ${roleColumn} = 'ADMIN'
        RETURNING id
      `,
      [adminUserId],
    );

    if (rows.length === 0) {
      throw new NotFoundException('Admin account was not found.');
    }

    return rows.map((row) => row.id);
  }

  private async activateAdminAndStoreStaff(
    adminUserId: number,
    storeId: number | null,
    userColumns: ReturnType<DatabaseService['resolveUserColumns']>,
  ) {
    if (!userColumns.statusColumn || !userColumns.roleColumn) {
      throw new InternalServerErrorException('Users table is missing required status columns.');
    }

    const statusColumn = this.quoteIdentifier(userColumns.statusColumn);
    const roleColumn = this.quoteIdentifier(userColumns.roleColumn);

    if (storeId && userColumns.storeIdColumn) {
      const storeIdColumn = this.quoteIdentifier(userColumns.storeIdColumn);
      const rows = await this.query<{ id: number }>(
        `
          UPDATE users
          SET ${statusColumn} = 'ACTIVE'
          WHERE (
            (id = $1 AND ${roleColumn} = 'ADMIN')
            OR (${roleColumn} = 'STAFF' AND ${storeIdColumn} = $2)
          )
          RETURNING id
        `,
        [adminUserId, storeId],
      );

      if (!rows.some((row) => Number(row.id) === adminUserId)) {
        throw new NotFoundException('Admin account was not found.');
      }

      return rows.map((row) => row.id);
    }

    const rows = await this.query<{ id: number }>(
      `
        UPDATE users
        SET ${statusColumn} = 'ACTIVE'
        WHERE id = $1
          AND ${roleColumn} = 'ADMIN'
        RETURNING id
      `,
      [adminUserId],
    );

    if (rows.length === 0) {
      throw new NotFoundException('Admin account was not found.');
    }

    return rows.map((row) => row.id);
  }

  private async deactivateStaffForStore(
    staffUserId: number,
    storeId: number,
    userColumns: ReturnType<DatabaseService['resolveUserColumns']>,
  ) {
    if (!userColumns.statusColumn || !userColumns.roleColumn || !userColumns.storeIdColumn) {
      return [];
    }

    const statusColumn = this.quoteIdentifier(userColumns.statusColumn);
    const roleColumn = this.quoteIdentifier(userColumns.roleColumn);
    const storeIdColumn = this.quoteIdentifier(userColumns.storeIdColumn);

    return this.query<{ id: number }>(
      `
        UPDATE users
        SET ${statusColumn} = 'INACTIVE'
        WHERE id = $1
          AND ${roleColumn} = 'STAFF'
          AND ${storeIdColumn} = $2
        RETURNING id
      `,
      [staffUserId, storeId],
    );
  }

  private async activateStaffForStore(
    staffUserId: number,
    storeId: number,
    userColumns: ReturnType<DatabaseService['resolveUserColumns']>,
  ) {
    if (!userColumns.statusColumn || !userColumns.roleColumn || !userColumns.storeIdColumn) {
      return [];
    }

    const statusColumn = this.quoteIdentifier(userColumns.statusColumn);
    const roleColumn = this.quoteIdentifier(userColumns.roleColumn);
    const storeIdColumn = this.quoteIdentifier(userColumns.storeIdColumn);

    return this.query<{ id: number }>(
      `
        UPDATE users
        SET ${statusColumn} = 'ACTIVE'
        WHERE id = $1
          AND ${roleColumn} = 'STAFF'
          AND ${storeIdColumn} = $2
        RETURNING id
      `,
      [staffUserId, storeId],
    );
  }

  private async hardDeleteUserByRole(
    userId: number,
    role: 'ADMIN' | 'STAFF',
    storeId: number | null,
    userColumns: ReturnType<DatabaseService['resolveUserColumns']>,
  ) {
    if (!userColumns.roleColumn) {
      throw new InternalServerErrorException('Users table is missing a role column.');
    }

    const roleColumn = this.quoteIdentifier(userColumns.roleColumn);
    const conditions = [`id = $1`, `${roleColumn} = $2`];
    const params: unknown[] = [userId, role];

    if (role === 'STAFF') {
      if (!userColumns.storeIdColumn || storeId === null) {
        throw new InternalServerErrorException('Staff deletion requires a store scope.');
      }

      conditions.push(`${this.quoteIdentifier(userColumns.storeIdColumn)} = $3`);
      params.push(storeId);
    }

    try {
      return await this.query<{ id: number }>(
        `
          DELETE FROM users
          WHERE ${conditions.join(' AND ')}
          RETURNING id
        `,
        params,
      );
    } catch (error) {
      this.handleDatabaseWriteError(error, 'Unable to remove user account.');
    }
  }

  private resolveStoreColumns(columns: Set<string>) {
    const pick = (candidates: string[]) => candidates.find((candidate) => columns.has(candidate.toLowerCase())) ?? null;

    return {
      joinable: columns.has('id'),
      storeTypeColumn: pick(['store_type', 'type', 'store_kind']),
      storeNameColumn: pick(['store_name', 'name']),
      storeDescriptionColumn: pick(['store_description', 'description']),
      logoUrlColumn: pick(['logo_url', 'store_logo_url']),
      contactNumberColumn: pick(['contact_number', 'phone_number', 'phone']),
      emailAddressColumn: pick(['email_address', 'store_email', 'email']),
      addressColumn: pick(['address', 'store_address']),
      updatedAtColumn: pick(['updated_at']),
    };
  }

  private quoteIdentifier(identifier: string) {
    return `"${identifier.replaceAll('"', '""')}"`;
  }

  private toDatabaseStoreType(storeType: 'RESTAURANT' | 'RETAIL_STORE') {
    return storeType === 'RETAIL_STORE' ? 'RETAIL' : storeType;
  }

  private normalizedStoreTypeSql(expression: string) {
    return `CASE WHEN ${expression} = 'RETAIL' THEN 'RETAIL_STORE' ELSE ${expression} END`;
  }

  private handleDatabaseWriteError(error: unknown, fallbackMessage: string): never {
    const databaseError = error as { code?: string; detail?: string; message?: string };

    if (databaseError.code === '23503') {
      throw new ConflictException(
        'This account is linked to other records and cannot be permanently deleted. Run backend/sql/add-user-is-active.sql to enable deactivation instead.',
      );
    }

    if (databaseError.code === '23505') {
      throw new ConflictException(databaseError.detail ?? 'A record with the same unique value already exists.');
    }

    if (databaseError.code === '23514') {
      throw new InternalServerErrorException(databaseError.detail ?? databaseError.message ?? fallbackMessage);
    }

    if (databaseError.code === '23502') {
      throw new InternalServerErrorException(databaseError.detail ?? databaseError.message ?? fallbackMessage);
    }

    throw error;
  }

  private generateTemporaryPassword() {
    return Math.random().toString(36).slice(-10);
  }
}
