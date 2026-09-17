import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Index('idx_file_references_origin', ['table_name', 'record_id'])
@Entity('file_references')
export class FileReference {

  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 100 })
  table_name!: string

  @Column({ type: 'int' })
  record_id!: number

  @Column({ type: 'varchar', length: 500 })
  path!: string

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbnail_path!: string | null

  @Column({ type: 'varchar', length: 255 })
  original_name!: string

  @Column({ type: 'varchar', length: 100 })
  mime_type!: string

  @Column({ type: 'int', unsigned: true })
  size_bytes!: number

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date
}