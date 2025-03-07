import "@ui5/webcomponents/dist/features/InputElementsFormSupport.js";

import { ValueState } from "@ui5/webcomponents-react";
import { FC, useContext, useMemo } from "react";
import { Controller, FieldError, useController } from "react-hook-form";

import {
  DateTimePicker,
  DateTimePickerProps,
} from "../component/DateTimePicker";
import { FormAdapterContext } from "../form/FormAdapter";
import { useI18nValidationError } from "../i18n/FormI18n";
import { FormFieldValidation } from "./types";
import { hasError } from "./util";

const convertToDateOnly = (
  value: Date | any,
  parse: (value: any) => Date | null
): Date | null => {
  const temp = value instanceof Date ? value : parse(value);
  if (temp != null) {
    return new Date(temp.getFullYear(), temp.getMonth(), temp.getDate());
  }

  return null;
};

const isErrorIgnored = (error: FieldError | undefined) =>
  // minDate and maxDate errors are already handled by web component -> no need to provide our own error message
  error != null && (error.type === "minDate" || error.type === "maxDate");

export type DateTimePickerFieldProps = Omit<
  DateTimePickerProps,
  "name" | "value" | "onChange" | "valueState" | "onBlur"
> &
  Pick<FormFieldValidation, "required"> & {
    name: string;
  };

export const DateTimePickerField: FC<DateTimePickerFieldProps> = ({
  name,
  required,
  minDate,
  maxDate,
  ...props
}) => {
  const {
    dateTime: { parse },
  } = useContext(FormAdapterContext);

  const rules: Partial<FormFieldValidation> = useMemo(
    () => ({
      required,
      validate: {
        ...(minDate == null
          ? {}
          : {
              minDate: (value?: Date | null) => {
                if (value == null) {
                  return true;
                }
                const normalizedValue = convertToDateOnly(value, parse);
                const normalizedMinDate = convertToDateOnly(minDate, parse);

                return (
                  normalizedValue == null ||
                  normalizedMinDate == null ||
                  normalizedValue >= normalizedMinDate
                );
              },
            }),
        ...(maxDate == null
          ? {}
          : {
              maxDate: (value?: Date | null) => {
                if (value == null) {
                  return true;
                }
                const normalizedValue = convertToDateOnly(value, parse);
                const normalizedMaxDate = convertToDateOnly(maxDate, parse);

                return (
                  normalizedValue == null ||
                  normalizedMaxDate == null ||
                  normalizedValue <= normalizedMaxDate
                );
              },
            }),
      },
    }),
    [parse, required, minDate, maxDate]
  );

  const getValidationErrorMessage = useI18nValidationError(name, rules);

  const { field, fieldState } = useController({
    name: name,
    rules,
  });

  // use null to reset value, undefined will be ignored by web component
  const value = field.value === undefined ? null : field.value;

  // get error message (Note: undefined fallbacks to default message of ui5 component)
  const errorMessage =
    hasError(fieldState.error) && !isErrorIgnored(fieldState.error)
      ? getValidationErrorMessage(fieldState.error, field.value)
      : undefined;

  return (
    <DateTimePicker
      {...props}
      ref={field.ref}
      name={field.name}
      value={value}
      minDate={minDate}
      maxDate={maxDate}
      onChange={(event, value) =>
        field.onChange(value != null ? value : undefined)
      }
      valueState={
        hasError(fieldState.error) ? ValueState.Error : ValueState.None
      }
      valueStateMessage={
        errorMessage != null && (
          <div slot="valueStateMessage">{errorMessage}</div>
        )
      }
      onBlur={field.onBlur}
      required={required}
    />
  );
};
