import { Input, InputType, ValueState } from "@ui5/webcomponents-react";
import { InputDomRef } from "@ui5/webcomponents-react/webComponents/Input";
import {
  ClipboardEvent,
  FC,
  KeyboardEvent,
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import { triggerSubmitOnEnter } from "../util";
import {
  getCurrencyConfig,
  getCurrencyFormatter,
} from "./helper/CurrencyHelper";
import { getFormatter } from "./helper/NumberFormatter";
import { getParser } from "./helper/NumberParser";
import {
  NumberWarningMessage,
  WarningMessageTypes,
  defaultNumberWarningMessageGetter,
} from "./helper/NumberWarningMessage";
import type {
  CommonNumberInputProps,
  NumberDisplayConfig,
  NumberInputConfig,
} from "./NumberModel";

const getDefinedNumberFormatOptions = (
  props: BaseNumberInputProps,
  propNames: Array<string>
) => {
  return propNames
    .filter((pn) => props.hasOwnProperty(pn))
    .reduce((collector, pn) => {
      // @ts-ignore: index signature not compatible with defined object shape
      collector[pn] = props[pn];
      return collector;
    }, {});
};

export interface BaseNumberInputProps
  extends CommonNumberInputProps,
    NumberDisplayConfig,
    NumberInputConfig {
  locale: string;
  currency?: string;
}

export const BaseNumberInput: FC<BaseNumberInputProps> = forwardRef<
  InputDomRef,
  BaseNumberInputProps
>((props, forwardedRef) => {
  const {
    value,
    onValue,
    locale,
    currency,
    minimumValue = Number.MIN_SAFE_INTEGER,
    maximumValue = Number.MAX_SAFE_INTEGER,
    minimumIntegerDigits,
    minimumFractionDigits,
    maximumFractionDigits,
    minimumSignificantDigits,
    maximumSignificantDigits,
    useGrouping = false,
    onKeyDown: onKeyDownOriginal,
    onKeyUp: onKeyUpOriginal,
    onFocus: onFocusOriginal,
    onBlur: onBlurOriginal,
    onPaste: onPasteOriginal,
    onMouseEnter: onMouseEnterOriginal,
    onMouseLeave: onMouseLeaveOriginal,
    valueState,
    valueStateMessage,
    showNumberWarningMessages = true,
    getNumberWarningMessage = defaultNumberWarningMessageGetter,
    ...passThrough
  } = props;

  const isFocusRef = useRef(false);
  const isPasteRef = useRef(false);
  const parser = useMemo(() => getParser(locale), [locale]);
  const groupingSeparator = parser.getGroupingSeparator();
  const decimalSeparator = parser.getDecimalSeparator();
  const lastValueRef = useRef(value);
  const [message, setMessage] = useState<NumberWarningMessage>();
  const [inputState, setInputState] = useState(false);
  const inputConfig = useMemo(() => {
    const result: Intl.NumberFormatOptions = getDefinedNumberFormatOptions(
      props,
      ["maximumFractionDigits", "currency"]
    );
    if (currency) {
      result.style = "currency";
    }

    result.useGrouping = false;
    return result;
  }, [maximumFractionDigits, currency]);
  const displayConfig = useMemo(() => {
    const result: Intl.NumberFormatOptions = getDefinedNumberFormatOptions(
      props,
      [
        "minimumIntegerDigits",
        "minimumFractionDigits",
        "maximumFractionDigits",
        "minimumSignificantDigits",
        "maximumSignificantDigits",
        "useGrouping",
        "currency",
      ]
    );
    if (currency) {
      result.style = "currency";
    }
    return result;
  }, [
    minimumIntegerDigits,
    minimumFractionDigits,
    maximumFractionDigits,
    minimumSignificantDigits,
    maximumSignificantDigits,
    useGrouping,
    currency,
  ]);

  if (minimumValue > 1) {
    throw Error("MinValue must be between Number.MIN_SAFE_INTEGER and 1!");
  } else if (maximumValue < -1) {
    throw Error("MaxValue must be between -1 and Number.MAX_SAFE_INTEGER!");
  }

  // Format numbers for input
  const formatForInput = useMemo(() => {
    const specialConf: Intl.NumberFormatOptions = {
      ...inputConfig,
      // always allow for less then the regular fraction digits while typing
      minimumIntegerDigits: undefined,
      minimumFractionDigits: undefined,
      minimumSignificantDigits: undefined,
      maximumSignificantDigits: undefined,
      // grouping would change all the time while typing => always off
      useGrouping: false,
    };

    // number input:
    const formatter = getFormatter(
      locale,
      currency ? getCurrencyConfig(specialConf, currency) : specialConf
    );

    return currency
      ? getCurrencyFormatter(formatter, currency)
      : formatter.format;
  }, [inputConfig, locale]);

  // Format numbers for display
  const formatForDisplay = useMemo(() => {
    const conf = currency
      ? getCurrencyConfig(displayConfig, currency)
      : displayConfig;

    // number display: grouping is false by default
    const formatter = getFormatter(locale, {
      useGrouping: false,
      ...conf,
    });

    return currency
      ? getCurrencyFormatter(formatter, currency)
      : formatter.format;
  }, [displayConfig, locale]);

  // number parser with min & max restriction
  const parseValue = useCallback(
    (inputValue?: string): number | undefined => {
      if (!inputValue) {
        return;
      }

      // parse the formatted number: max restrictions might apply
      let result = parser.parse(formatForInput(parser.parse(inputValue)));

      if (result !== undefined && result > maximumValue) {
        result = maximumValue;
      }
      if (result !== undefined && result < minimumValue) {
        result = minimumValue;
      }

      return result;
    },
    [parser, formatForInput]
  );

  // current value
  const currentValueRef = useRef(
    value !== undefined ? formatForInput(parseValue(String(value))) : undefined
  );

  // determine maxFracDigits
  const maxFractionDigits = useMemo(() => {
    const decimalTest = formatForInput(0.1111111111111111);
    return decimalTest.length <= 1 ? 0 : decimalTest.length - 2;
  }, [formatForInput]);

  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      const data = event.clipboardData.getData("text");
      const parsed = parseValue(data);

      // not a number
      if (parsed === undefined) {
        event.preventDefault();
        event.stopPropagation();

        setMessage({
          type: WarningMessageTypes.BLOCKED_NOT_A_NUMBER,
          discardedValue: data,
        });
        return;
      }

      isPasteRef.current = true;

      if (onPasteOriginal) {
        onPasteOriginal(event);
      }
    },
    [parseValue, onPasteOriginal]
  );

  /**
   * Prevent invalid data, e.g. not a number.
   */
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const originalValue = event.currentTarget.value;

      if (event.code === "Space") {
        event.preventDefault();
        event.stopPropagation();

        setMessage({
          type: WarningMessageTypes.BLOCKED_WHITESPACE,
          discardedValue: " ",
        });
        return false;
      }

      if (minimumValue === 0 && event.key === "-") {
        event.preventDefault();
        event.stopPropagation();

        setMessage({
          type: WarningMessageTypes.BLOCKED_NEGATIVE_NUMBER,
          discardedValue: event.key,
        });
        return false;
      }

      /**
       * We're only interested in those keys which change our number value
       * and these consist of a single char.
       * Control keys / special keys get a descriptive name, i.e. longer than 1 char.
       *
       * Special handling:
       * - key combinations (pressing STRG/ALT simultaneously)
       */
      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        event.key !== "-"
      ) {
        // note: newValue might not be the real current value,
        // since selection & current cursor position are not taken into account
        const newValue = originalValue + event.key;
        const value = parser.parse(newValue);
        const isNan = newValue && value === undefined;

        // no fraction digits, but fraction sign
        const isBlockedFraction =
          maxFractionDigits === 0 && event.key === decimalSeparator;

        // block invalid content
        if (isNan || isBlockedFraction) {
          event.preventDefault();
          event.stopPropagation();

          setMessage({
            type: isNan
              ? WarningMessageTypes.BLOCKED_NOT_A_NUMBER
              : WarningMessageTypes.BLOCKED_FRACTION,
            discardedValue: event.key,
          });
          return false;
        }
      }

      // allow consumers to have access to onKeyDown too
      if (onKeyDownOriginal) {
        onKeyDownOriginal(event);
      }

      // changed
      setMessage(undefined);
    },
    [parser, maxFractionDigits, decimalSeparator, onKeyDownOriginal]
  );

  /**
   * Sets the current value, enables submit via enter and triggers events.
   */
  const onKeyUp = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      const originalValue = event.currentTarget.value;
      const parsedValue = parser.parse(originalValue);
      const safeValue = parseValue(originalValue);

      if (originalValue !== currentValueRef.current && originalValue !== "-") {
        isPasteRef.current = false;

        // parsed value is invalid, but the original value has content
        // => reset to last valid value before the change
        if (parsedValue === undefined && originalValue !== "") {
          event.currentTarget.value = currentValueRef.current || "";
          setMessage({
            type: WarningMessageTypes.RESET_NOT_A_NUMBER,
            discardedValue: originalValue,
          });
          return;
        }

        // too many fraction digits
        const decIndex = originalValue.indexOf(decimalSeparator);
        const fracDigits =
          decIndex < 0 ? 0 : originalValue.length - 1 - decIndex;
        const tooManyFracs = fracDigits > maxFractionDigits;

        // if parseValue changed the value, then reset the input to our value
        // corner case for checking tooManyFracs: 1.110 => 1.11
        if (safeValue !== parsedValue || tooManyFracs) {
          const isChanged =
            safeValue !== undefined && parsedValue !== undefined;
          currentValueRef.current = formatForInput(safeValue);
          event.currentTarget.value = currentValueRef.current || "";
          setMessage({
            type: tooManyFracs
              ? WarningMessageTypes.MODIFIED_MAX_FRACTION_DIGITS
              : !isChanged
              ? WarningMessageTypes.MODIFIED
              : safeValue > parsedValue
              ? WarningMessageTypes.MODIFIED_MIN_NUMBER
              : WarningMessageTypes.MODIFIED_MAX_NUMBER,
            discardedValue: originalValue,
          });
          return;
        }

        // set the current value
        currentValueRef.current = originalValue;
      }

      // allow for submit via enter
      triggerSubmitOnEnter(event);

      // allow consumers to have access to onKeyUp too
      if (onKeyUpOriginal) {
        onKeyUpOriginal(event);
      }
    },
    [
      parser,
      groupingSeparator,
      decimalSeparator,
      parseValue,
      onValue,
      onKeyUpOriginal,
    ]
  );

  const leaveInputState = useCallback(() => {
    setInputState(false);
    setMessage(undefined);
    const val = parseValue(currentValueRef.current);
    currentValueRef.current = formatForInput(val);

    // extra method to provide the value as number
    if (onValue) {
      onValue(val);
    }
  }, [setInputState, formatForInput, parseValue]);

  const onFocus = useCallback(
    (event) => {
      isFocusRef.current = true;
      setInputState(true);

      if (onFocusOriginal) {
        onFocusOriginal(event);
      }
    },
    [setInputState, onFocusOriginal]
  );

  const onBlur = useCallback(
    (event) => {
      isFocusRef.current = false;
      leaveInputState();

      if (onBlurOriginal) {
        onBlurOriginal(event);
      }
    },
    [leaveInputState, onBlurOriginal]
  );

  const onMouseEnter = useCallback(
    (event) => {
      setInputState(true);
      if (onMouseEnterOriginal) {
        onMouseEnterOriginal(event);
      }
    },
    [setInputState, onMouseEnterOriginal]
  );

  const onMouseLeave = useCallback(
    (event) => {
      if (!isFocusRef.current) {
        leaveInputState();
      }

      if (onMouseLeaveOriginal) {
        onMouseLeaveOriginal(event);
      }
    },
    [leaveInputState, onMouseLeaveOriginal]
  );

  // support externally set values, required for form reset
  if (lastValueRef.current !== value) {
    const val =
      value !== undefined
        ? formatForInput(parseValue(String(value)))
        : undefined;
    if (val !== currentValueRef.current) {
      currentValueRef.current = val;
    }
  }
  lastValueRef.current = value;

  // handle warnings
  const showWarning = showNumberWarningMessages && message;
  const msgType = showWarning ? ValueState.Warning : valueState;
  const msg = !showWarning ? (
    valueStateMessage
  ) : (
    <div slot="valueStateMessage">
      {getNumberWarningMessage(message.type, message.discardedValue)}
    </div>
  );

  // the final string value for the input field
  const formattedValue = inputState
    ? currentValueRef.current || ""
    : formatForDisplay(parseValue(currentValueRef.current));

  return (
    <Input
      {...passThrough}
      type={InputType.Text}
      inputMode={maxFractionDigits === 0 ? "numeric" : "decimal"}
      maxlength={18}
      ref={forwardedRef}
      value={formattedValue}
      valueState={msgType}
      valueStateMessage={msg}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onFocus={onFocus}
      onBlur={onBlur}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onPaste={onPaste}
    />
  );
});
