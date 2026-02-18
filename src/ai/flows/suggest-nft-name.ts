'use server';
/**
 * @fileOverview An AI agent for suggesting creative names for NFTs based on their characteristics.
 *
 * - suggestNftName - A function that handles the NFT name suggestion process.
 * - SuggestNftNameInput - The input type for the suggestNftName function.
 * - SuggestNftNameOutput - The return type for the suggestNftName function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RARITY_MAP: Record<number, string> = {
  0: 'Common',
  1: 'Rare',
  2: 'Super Rare',
  3: 'Super Super Rare (SSR)',
  4: 'Ultra Rare',
  5: 'Legend Rare',
};

const SuggestNftNameInputSchema = z.object({
  nftRarity: z.number().int().min(0).max(5).describe('The rarity of the NFT (0-5).'),
  nftVariantType: z.string().describe('The variant type of the NFT (e.g., "Normal", "Shiny", "Holographic").'),
  nftImageUrl: z.string().describe("A photo of the NFT, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
  nftBaseName: z.string().describe('The base name of the NFT (e.g., "GyateGyate Classic").'),
});
export type SuggestNftNameInput = z.infer<typeof SuggestNftNameInputSchema>;

const SuggestNftNameOutputSchema = z.string().describe('A creative and compelling name for the NFT.');
export type SuggestNftNameOutput = z.infer<typeof SuggestNftNameOutputSchema>;

// The schema for the actual input passed to the prompt, which includes the derived rarityText.
const NftNamingPromptInputSchema = SuggestNftNameInputSchema.omit({ nftRarity: true }).extend({
  rarityText: z.string().describe('The textual representation of the NFT rarity.'),
});

const nftNamingPrompt = ai.definePrompt({
  name: 'suggestNftNamePrompt',
  input: {schema: NftNamingPromptInputSchema},
  output: {schema: SuggestNftNameOutputSchema},
  prompt: `You are an expert in naming collectible NFTs for a marketplace. Your goal is to suggest a cool, compelling, and creative name that matches the characteristics of the NFT.

Consider the following details:
- Base Name: {{{nftBaseName}}}
- Rarity: {{{rarityText}}}
- Variant Type: {{{nftVariantType}}}
- Image: {{media url=nftImageUrl}}

Based on these characteristics, propose a single, creative name for this NFT.
Do not include any other text or explanation, just the suggested name.`,
});

const suggestNftNameFlow = ai.defineFlow(
  {
    name: 'suggestNftNameFlow',
    inputSchema: SuggestNftNameInputSchema,
    outputSchema: SuggestNftNameOutputSchema,
  },
  async (input) => {
    const rarityText = RARITY_MAP[input.nftRarity] || 'Unknown Rarity';
    const promptInput = {
      nftVariantType: input.nftVariantType,
      nftImageUrl: input.nftImageUrl,
      nftBaseName: input.nftBaseName,
      rarityText: rarityText,
    };
    const {output} = await nftNamingPrompt(promptInput);
    if (!output) {
      throw new Error('Failed to generate NFT name.');
    }
    return output;
  }
);

export async function suggestNftName(input: SuggestNftNameInput): Promise<SuggestNftNameOutput> {
  return suggestNftNameFlow(input);
}
