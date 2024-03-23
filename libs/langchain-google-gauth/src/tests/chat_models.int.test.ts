import {expect, test} from "@jest/globals";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageChunk, BaseMessageLike,
  HumanMessage,
  MessageContentComplex,
  MessageContentText,
  SystemMessage, ToolMessage,
} from "@langchain/core/messages";
import { GeminiTool } from "@langchain/google-common";
import { ChatGoogle } from "../chat_models.js";
import { GoogleLLM } from "../llms.js";

describe("GAuth Chat", () => {
  test("platform", async () => {
    const model = new GoogleLLM();
    expect(model.platform).toEqual("gcp");
  });

  test("invoke", async () => {
    const model = new ChatGoogle();
    try {
      const res = await model.invoke("What is 1 + 1?");
      expect(res).toBeDefined();
      expect(res._getType()).toEqual("ai");

      const aiMessage = res as AIMessageChunk;
      expect(aiMessage.content).toBeDefined();
      expect(aiMessage.content.length).toBeGreaterThan(0);
      expect(aiMessage.content[0]).toBeDefined();

      const content = aiMessage.content[0] as MessageContentComplex;
      expect(content).toHaveProperty("type");
      expect(content.type).toEqual("text");

      const textContent = content as MessageContentText;
      expect(textContent.text).toBeDefined();
      expect(textContent.text).toEqual("2");
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  test("generate", async () => {
    const model = new ChatGoogle();
    try {
      const messages: BaseMessage[] = [
        new SystemMessage(
          "You will reply to all requests to flip a coin with either H, indicating heads, or T, indicating tails."
        ),
        new HumanMessage("Flip it"),
        new AIMessage("T"),
        new HumanMessage("Flip the coin again"),
      ];
      const res = await model.predictMessages(messages);
      expect(res).toBeDefined();
      expect(res._getType()).toEqual("ai");

      const aiMessage = res as AIMessageChunk;
      expect(aiMessage.content).toBeDefined();
      expect(aiMessage.content.length).toBeGreaterThan(0);
      expect(aiMessage.content[0]).toBeDefined();

      const content = aiMessage.content[0] as MessageContentComplex;
      expect(content).toHaveProperty("type");
      expect(content.type).toEqual("text");

      const textContent = content as MessageContentText;
      expect(textContent.text).toBeDefined();
      expect(["H", "T"]).toContainEqual(textContent.text);
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  test("stream", async () => {
    const model = new ChatGoogle();
    try {
      const input: BaseLanguageModelInput = new ChatPromptValue([
        new SystemMessage(
          "You will reply to all requests to flip a coin with either H, indicating heads, or T, indicating tails."
        ),
        new HumanMessage("Flip it"),
        new AIMessage("T"),
        new HumanMessage("Flip the coin again"),
      ]);
      const res = await model.stream(input);
      const resArray: BaseMessageChunk[] = [];
      for await (const chunk of res) {
        resArray.push(chunk);
      }
      expect(resArray).toBeDefined();
      expect(resArray.length).toBeGreaterThanOrEqual(1);

      const lastChunk = resArray[resArray.length - 1];
      expect(lastChunk).toBeDefined();
      expect(lastChunk._getType()).toEqual("ai");
      const aiChunk = lastChunk as AIMessageChunk;
      console.log(aiChunk);

      console.log(JSON.stringify(resArray, null, 2));
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  test("function", async () => {
    const tools: GeminiTool[] = [
      {
        functionDeclarations: [
          {
            name: "test",
            description: "Run a test with a specific name and get if it passed or failed",
            parameters: {
              type: "object",
              properties: {
                testName: {
                  type: "string",
                  description: "The name of the test that should be run.",
                }
              },
              required: [
                "testName"
              ]
            }
          }
        ]
      }
    ];
    const model = new ChatGoogle({
      tools,
    })
    const result = await model.invoke("Run a test on the cobalt project");
    expect(result).toHaveProperty("content");
    expect(Array.isArray(result.content)).toBeTruthy();
    expect(result.content).toHaveLength(0);
    const args = result?.lc_kwargs?.additional_kwargs;
    expect(args).toBeDefined();
    expect(args).toHaveProperty("tool_calls");
    expect(Array.isArray(args.tool_calls)).toBeTruthy();
    expect(args.tool_calls).toHaveLength(1);
    const call = args.tool_calls[0];
    expect(call).toHaveProperty("type");
    expect(call.type).toBe("function");
    expect(call).toHaveProperty("function");
    const func = call.function;
    expect(func).toBeDefined();
    expect(func).toHaveProperty("name");
    expect(func.name).toBe("test");
    expect(func).toHaveProperty("arguments");
    expect(typeof func.arguments).toBe("string");
    expect(func.arguments.replaceAll("\n","")).toBe("{\"testName\":\"cobalt\"}");
  })

  test("function reply", async () => {
    const tools: GeminiTool[] = [
      {
        functionDeclarations: [
          {
            name: "test",
            description: "Run a test with a specific name and get if it passed or failed",
            parameters: {
              type: "object",
              properties: {
                testName: {
                  type: "string",
                  description: "The name of the test that should be run.",
                }
              },
              required: [
                "testName"
              ]
            }
          }
        ]
      }
    ];
    const model = new ChatGoogle({
      tools,
    })
    const toolResult = {
      testPassed: true,
    }
    const messages: BaseMessageLike[] = [
      new HumanMessage("Run a test on the cobalt project."),
      new AIMessage("", {
        "tool_calls": [
          {
            "id": "test",
            "type": "function",
            "function": {
              "name": "test",
              "arguments": "{\"testName\":\"cobalt\"}"
            }
          }
        ]
      }),
      new ToolMessage(JSON.stringify(toolResult), "test"),
    ];
    const res = await model.stream(messages);
    const resArray: BaseMessageChunk[] = [];
    for await (const chunk of res) {
      resArray.push(chunk);
    }
    console.log(JSON.stringify(resArray, null, 2));
  })
});
