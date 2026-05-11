/**
 * BaseRepository.ts — TutorBoard Generic Repository
 * 
 * Abstracts Mongoose CRUD operations behind a clean interface.
 * Controllers/services should use repositories instead of importing
 * models directly. This enables:
 *   - Testability (mock the repository, not Mongoose)
 *   - Consistent error handling
 *   - Query logging / metrics
 *   - Future migration away from Mongoose
 */

import { Model, Document } from 'mongoose';
import { normalizeUpdate } from '../utils/mongo/updateBuilder.js';

// Generic query types — compatible with Mongoose v8+v9
type FilterQuery<T> = Record<string, any>;
type UpdateQuery<T> = Record<string, any>;
type QueryOptions = Record<string, any>;

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class BaseRepository<T extends Document> {
  constructor(protected readonly model: Model<T>) {}

  async findById(id: string, projection?: string | Record<string, number>): Promise<T | null> {
    return this.model.findById(id, projection).lean().exec() as Promise<T | null>;
  }

  async findOne(filter: FilterQuery<T>, projection?: string | Record<string, number>): Promise<T | null> {
    return this.model.findOne(filter, projection).lean().exec() as Promise<T | null>;
  }

  async findMany(
    filter: FilterQuery<T>,
    options?: PaginationOptions
  ): Promise<PaginatedResult<T>> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const sort = options?.sort ?? { createdAt: -1 };

    const [data, total] = await Promise.all([
      this.model
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec() as Promise<T[]>,
      this.model.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(data: Partial<T>): Promise<T> {
    const doc = await this.model.create(data);
    return doc.toObject() as T;
  }

  async updateById(id: string, update: UpdateQuery<T>, options?: QueryOptions): Promise<T | null> {
    return this.model
      .findByIdAndUpdate(id, normalizeUpdate(update), { returnDocument: 'after', runValidators: true, ...options })
      .lean()
      .exec() as Promise<T | null>;
  }

  async updateOne(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<T | null> {
    return this.model
      .findOneAndUpdate(filter, normalizeUpdate(update), { returnDocument: 'after', runValidators: true })
      .lean()
      .exec() as Promise<T | null>;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id).exec();
    return result !== null;
  }

  async exists(filter: FilterQuery<T>): Promise<boolean> {
    const count = await this.model.countDocuments(filter).limit(1).exec();
    return count > 0;
  }

  async count(filter: FilterQuery<T>): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  /**
   * Atomic operations — use these instead of read-modify-write patterns
   */
  async atomicPush(id: string, field: string, value: unknown): Promise<T | null> {
    return this.model
      .findByIdAndUpdate(id, { $push: { [field]: value } } as UpdateQuery<T>, { returnDocument: 'after' })
      .lean()
      .exec() as Promise<T | null>;
  }

  async atomicPull(id: string, field: string, condition: Record<string, unknown>): Promise<T | null> {
    return this.model
      .findByIdAndUpdate(id, { $pull: { [field]: condition } } as UpdateQuery<T>, { returnDocument: 'after' })
      .lean()
      .exec() as Promise<T | null>;
  }

  async atomicIncrement(id: string, field: string, amount: number = 1): Promise<T | null> {
    return this.model
      .findByIdAndUpdate(id, { $inc: { [field]: amount } } as UpdateQuery<T>, { returnDocument: 'after' })
      .lean()
      .exec() as Promise<T | null>;
  }
}
