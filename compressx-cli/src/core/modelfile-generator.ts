export function generateModelfile(
  ggufFilename: string,
  modelName: string,
  quantType: string
): string {
  return `# Modelfile for ${modelName} (${quantType.toUpperCase()})
# Compressed with CompressX (https://compressx.asmith.media)
FROM ./${ggufFilename}

# System prompt (customize as needed)
SYSTEM """You are a helpful assistant."""

# Parameters
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
`;
}
