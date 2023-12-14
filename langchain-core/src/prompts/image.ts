import { ImagePromptValue, ImageURL } from "../prompt_values.js";
import type { InputValues, PartialValues } from "../utils/types.js";
import {
  BasePromptTemplate,
  BasePromptTemplateInput,
  TypedPromptInputValues,
} from "./base.js";
import { TemplateFormat } from "./template.js";

/**
 * Inputs to create a {@link ImagePromptTemplate}
 * @augments BasePromptTemplateInput
 */
export interface ImagePromptTemplateInput<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
> extends BasePromptTemplateInput<RunInput, PartialVariableName> {
  /**
   * The prompt template
   */
  template: Record<string, unknown>;

  /**
   * The format of the prompt template. Options are 'f-string'
   *
   * @defaultValue 'f-string'
   */
  templateFormat?: TemplateFormat;

  /**
   * Whether or not to try validating the template on initialization
   *
   * @defaultValue `true`
   */
  validateTemplate?: boolean;
}

/**
 * An image prompt template for a multimodal model.
 */
export class ImagePromptTemplate<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends InputValues = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PartialVariableName extends string = any
> extends BasePromptTemplate<RunInput, ImagePromptValue, PartialVariableName> {
  static lc_name() {
    return "ImagePromptTemplate";
  }

  template: Record<string, unknown>;

  templateFormat: TemplateFormat = "f-string";

  validateTemplate = true;

  constructor(input: ImagePromptTemplateInput<RunInput, PartialVariableName>) {
    super(input);
    this.template = input.template;
    this.templateFormat = input.templateFormat ?? this.templateFormat;
    this.validateTemplate = input.validateTemplate ?? this.validateTemplate;

    if (this.validateTemplate) {
      let totalInputVariables: string[] = this.inputVariables;
      if (this.partialVariables) {
        totalInputVariables = totalInputVariables.concat(
          Object.keys(this.partialVariables)
        );
      }
      /** @TODO Fix this */
      // checkValidTemplate(
      //   this.template,
      //   this.templateFormat,
      //   totalInputVariables
      // );
    }
  }

  _getPromptType(): "prompt" {
    return "prompt";
  }

  /**
   * Partially applies values to the prompt template.
   * @param values The values to be partially applied to the prompt template.
   * @returns A new instance of ImagePromptTemplate with the partially applied values.
   */
  async partial<NewPartialVariableName extends string>(
    values: PartialValues<NewPartialVariableName>
  ) {
    const newInputVariables = this.inputVariables.filter(
      (iv) => !(iv in values)
    ) as Exclude<Extract<keyof RunInput, string>, NewPartialVariableName>[];
    const newPartialVariables = {
      ...(this.partialVariables ?? {}),
      ...values,
    } as PartialValues<PartialVariableName | NewPartialVariableName>;
    const promptDict = {
      ...this,
      inputVariables: newInputVariables,
      partialVariables: newPartialVariables,
    };
    return new ImagePromptTemplate<
      InputValues<
        Exclude<Extract<keyof RunInput, string>, NewPartialVariableName>
      >
    >(promptDict);
  }

  /**
   * Formats the prompt template with the provided values.
   * @param values The values to be used to format the prompt template.
   * @returns A promise that resolves to a string which is the formatted prompt.
   */
  async format<FormatOutput = ImageURL>(
    values: TypedPromptInputValues<RunInput>
  ): Promise<FormatOutput> {
    const formatted: Record<string, any> = {};
    for (const [key, value] of Object.entries(this.template)) {
      if (typeof value === "string") {
        formatted[key] = value.replace(/{([^{}]*)}/g, (match, group) => {
          const replacement = values[group];
          return typeof replacement === "string" ||
            typeof replacement === "number"
            ? String(replacement)
            : match;
        });
      } else {
        formatted[key] = value;
      }
    }
    let url = values.url || formatted.url;
    const path = values.path || formatted.path;
    const detail = values.detail || formatted.detail;
    if (!url && !path) {
      throw new Error("Must provide either url or path.");
    }
    if (!url) {
      if (typeof path !== "string") {
        throw new Error("path must be a string.");
      }
      // Requires node:fs so we don't want to always
      // import for client side application support.
      const { imageToDataUrl } = await ImagePromptTemplate.imports();
      url = await imageToDataUrl(path);
    }
    if (typeof url !== "string") {
      throw new Error("url must be a string.");
    }
    const output: ImageURL = { url };
    if (detail) {
      output.detail = detail;
    }
    return output as FormatOutput;
  }

  /** @ignore */
  static async imports(): Promise<{
    imageToDataUrl: (imagePath: string) => Promise<string>;
  }> {
    try {
      const { imageToDataUrl } = await import("../utils/image.js");
      return { imageToDataUrl };
    } catch (e) {
      throw new Error(
        "Please install cohere-ai as a dependency with, e.g. `yarn add cohere-ai`"
      );
    }
  }

  /**
   * Formats the prompt given the input values and returns a formatted
   * prompt value.
   * @param values The input values to format the prompt.
   * @returns A Promise that resolves to a formatted prompt value.
   */
  async formatPromptValue(
    values: TypedPromptInputValues<RunInput>
  ): Promise<ImagePromptValue> {
    const formattedPrompt = await this.format(values);
    return new ImagePromptValue(formattedPrompt);
  }
}
