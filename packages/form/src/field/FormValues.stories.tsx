import { action } from "@storybook/addon-actions";
import { Story } from "@storybook/react";

import { FormController, FormControllerProps } from "../form/FormController";
import { FormValues, FormValuesProps } from "./FormValues";
import { TextInputField } from "./TextInputField";

interface FormData {
  text?: string;
}

const Template: Story<
  FormControllerProps<FormData> & FormValuesProps<FormData>
> = (args) => {
  const { initialValues, onSubmit } = args;

  return (
    <FormController<FormData> {...{ initialValues, onSubmit }}>
      <TextInputField name={"text"} />
      <div>
        <button type="submit">Submit</button>
        <button type="reset">Reset</button>
      </div>
      <FormValues {...args} />
    </FormController>
  );
};

export const Standard = Template.bind({});
Standard.args = {
  onSubmit: async (...args) => {
    action("submit")(...args);

    const [values, actions] = args;

    actions.setValues([
      { name: "text", value: "Random value: " + new Date().getTime() },
    ]);
  },
  render: (values) => <div>Form Values {JSON.stringify(values)}</div>,
};

export default {
  title: "Form/Field/FormValues",
  component: FormValues,
};
