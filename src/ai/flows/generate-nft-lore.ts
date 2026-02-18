'use server';
/**
 * @fileOverview An AI agent for generating lore or detailed descriptions for NFTs.
 *
 * - generateNftLore - A function that handles the NFT lore generation process.
 * - GenerateNftLoreInput - The input type for the generateNftLore function.
 * - GenerateNftLoreOutput - The return type for the generateNftLore function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateNftLoreInputSchema = z.object({
  name: z.string().describe('The name of the NFT.'),
  rarity: z.string().describe('The rarity of the NFT (e.g., Common, Rare, Super Rare, Ultra Rare, Legend Rare).'),
  variant_type: z.string().describe('The variant type of the NFT (e.g., Normal, Shiny, Holographic).'),
  hp: z.number().describe('The Health Points (HP) stat of the NFT.'),
  atk: z.number().describe('The Attack (ATK) stat of the NFT.'),
  spd: z.number().describe('The Speed (SPD) stat of the NFT.'),
  image_url: z.string().url().describe('The URL of the NFT image.'),
});
export type GenerateNftLoreInput = z.infer<typeof GenerateNftLoreInputSchema>;

const GenerateNftLoreOutputSchema = z.object({
  lore: z.string().describe('The generated lore or detailed description for the NFT.'),
});
export type GenerateNftLoreOutput = z.infer<typeof GenerateNftLoreOutputSchema>;

export async function generateNftLore(input: GenerateNftLoreInput): Promise<GenerateNftLoreOutput> {
  return generateNftLoreFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateNftLorePrompt',
  input: { schema: GenerateNftLoreInputSchema },
  output: { schema: GenerateNftLoreOutputSchema },
  prompt: `You are a master storyteller and lore creator for a fantasy game called GyateGyate. Your task is to craft compelling and unique lore for an NFT based on its characteristics.

NFT Details:
Name: {{{name}}}
Rarity: {{{rarity}}}
Variant: {{{variant_type}}}
Health Points (HP): {{{hp}}}
Attack (ATK): {{{atk}}}
Speed (SPD): {{{spd}}}
Image: {{{image_url}}} (This image depicts the visual appearance of the NFT.)

Create a detailed and engaging lore entry, approximately 3-5 paragraphs long, that brings this NFT to life. Focus on its origins, special abilities, its role in the GyateGyate universe, and how its rarity and variant type influence its legend. Make it sound epic and mysterious.`,
});

const generateNftLoreFlow = ai.defineFlow(
  {
    name: 'generateNftLoreFlow',
    inputSchema: GenerateNftLoreInputSchema,
    outputSchema: GenerateNftLoreOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
