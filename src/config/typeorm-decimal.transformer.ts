import { ValueTransformer } from 'typeorm'

export const DecimalTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => value === null ? null : Number(value)
}
