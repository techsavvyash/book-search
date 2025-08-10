#!/usr/bin/env python3
"""
Story Meta-Tags Generator using DSPy and Gemini 2.5

Usage:
    python main.py --cot    # Use Chain of Thought
    python main.py          # Direct generation without reasoning
"""

import os
import argparse
import pandas as pd
import dspy
from pathlib import Path
from dotenv import load_dotenv
import logging
import re
import json

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MetaTagSignature(dspy.Signature):
    """Generate comprehensive meta-tags for a story in 11 categories."""
    story_text = dspy.InputField(desc="The full text of the story")
    meta_tags_json = dspy.OutputField(desc="""Generate meta-tags in exactly this JSON format:
{
    "character_primary": "List of main characters that are essential to story, appears in most pages. It should be the named characters as well as the Generic and Broad Character Classes like 'hero', 'boy', 'dog', 'cat', 'mother', 'father', 'teacher', 'student' etc.",
    "character_secondary": "List of secondary characters that can be changed without affecting core story, appears only in few pages. It should be the named characters as well as the Generic and Broad Character Classes like 'hero', 'boy', 'dog', 'cat', 'mother', 'father', 'teacher', 'student' etc.",
    "setting_primary": "Primary geographical location, type of space, time period, rural/urban classification - Central to the story",
    "setting_secondary": "Secondary or background settings - Less important to main plot",
    "theme_primary": "Main scientific themes, concepts, social themes, ideas, curriculum subjects, genre - Core to the story along with the curriculum terms, or genre related terms which aren't directly stated but implied in the story.",
    "theme_secondary": "Secondary or supporting themes - Present but not central, along with the curriculum terms, or genre related terms which aren't directly stated but implied in the story.",
    "events_primary": "Major events and main problems handled by characters - Critical to story progression",
    "events_secondary": "Minor events and side problems - Could be removed without major impact",
    "emotions_primary": "Main emotions expressed or felt by characters, overall story emotion - Dominant throughout",
    "emotions_secondary": "Secondary emotions and feelings - Occasional or background emotions",
    "keywords": "List of important keywords from the whole text that can be used for search and indexing - Should be filtered to remove common words and focus on unique terms"
}
""")
# Comment with details 
"""Generate meta-tags in exactly this JSON format:   
{
    "character_primary": "List of main characters with details: Name, Age, Gender, Jobs, Relationships, Other attributes - Essential to story, appears in most pages",
    "character_secondary": "List of secondary characters with details - Can be changed without affecting core story, appears only in few pages",
    "setting_primary": "Primary geographical location, type of space, time period, rural/urban classification - Central to the story",
    "setting_secondary": "Secondary or background settings - Less important to main plot",
    "theme_primary": "Main scientific themes, concepts, social themes, ideas, curriculum subjects, genre - Core to the story",
    "theme_secondary": "Secondary or supporting themes - Present but not central",
    "events_primary": "Major events and main problems handled by characters - Critical to story progression",
    "events_secondary": "Minor events and side problems - Could be removed without major impact",
    "emotions_primary": "Main emotions expressed or felt by characters, overall story emotion - Dominant throughout",
    "emotions_secondary": "Secondary emotions and feelings - Occasional or background emotions",
    "keywords": "Filtered list of important keywords from the whole text"
}"""


class MetaTagCOTSignature(dspy.Signature):
    """Generate comprehensive meta-tags for a story with reasoning."""
    story_text = dspy.InputField(desc="The full text of the story")
    analysis = dspy.OutputField(desc="Analysis of key plot points, characters, themes, and concepts to understand the story's educational and thematic elements")
    meta_tags_json = dspy.OutputField(desc="""Generate meta-tags in exactly this JSON format:
{
    "character_primary": "List of main characters with details: Name, Age, Gender, Jobs, Relationships, Other attributes - Essential to story, appears in most pages",
    "character_secondary": "List of secondary characters with details - Can be changed without affecting core story, appears only in few pages",
    "setting_primary": "Primary geographical location, type of space, time period, rural/urban classification - Central to the story",
    "setting_secondary": "Secondary or background settings - Less important to main plot",
    "theme_primary": "Main scientific themes, concepts, social themes, ideas, curriculum subjects, genre - Core to the story",
    "theme_secondary": "Secondary or supporting themes - Present but not central",
    "events_primary": "Major events and main problems handled by characters - Critical to story progression",
    "events_secondary": "Minor events and side problems - Could be removed without major impact",
    "emotions_primary": "Main emotions expressed or felt by characters, overall story emotion - Dominant throughout",
    "emotions_secondary": "Secondary emotions and feelings - Occasional or background emotions",
    "keywords": "Filtered list of important keywords from the whole text"
}""")

class StoryProcessor:
    def __init__(self, use_cot=False):
        """Initialize the story processor with DSPy configuration."""
        # Load environment variables
        load_dotenv()
        
        # Get Gemini API key
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in .env file")
        
        # Configure DSPy with Gemini
        try:
            # Using Google's Gemini model through DSPy
            # lm = dspy.LM(model="gemini/gemini-1.5-flash", api_key=api_key)
            lm = dspy.Google(model="gemini-1.5-flash", api_key=api_key)
            dspy.settings.configure(lm=lm)
            logger.info("Successfully configured Gemini 2.5 model")
        except Exception as e:
            logger.error(f"Failed to configure Gemini model: {e}")
            raise
        
        # Setup predictor based on COT option
        self.use_cot = use_cot
        if use_cot:
            self.predictor = dspy.ChainOfThought(MetaTagCOTSignature)
            logger.info("Using Chain of Thought for meta-tags generation")
        else:
            self.predictor = dspy.Predict(MetaTagSignature)
            logger.info("Using direct prediction for meta-tags generation")
    
    def scan_text_files(self, folder_path="./STEM-text-files"):
        """Scan folder for text files and create initial CSV."""
        folder = Path(folder_path)
        if not folder.exists():
            logger.error(f"Folder '{folder_path}' does not exist")
            return None
        
        text_files = list(folder.glob("*.txt"))
        if not text_files:
            logger.warning(f"No .txt files found in '{folder_path}'")
            return None
        
        # Create DataFrame with filenames
        df = pd.DataFrame({
            'filename': [f.name for f in text_files],
            'filepath': [str(f) for f in text_files]
        })
        
        # Save to CSV
        csv_path = "story_files.csv"
        df.to_csv(csv_path, index=False)
        logger.info(f"Created CSV with {len(text_files)} text files: {csv_path}")
        
        return csv_path
    
    def read_story_file(self, filepath):
        """Read and return the content of a story file."""
        try:
            with open(filepath, 'r', encoding='utf-8') as file:
                content = file.read().strip()
            return content
        except Exception as e:
            logger.error(f"Error reading file {filepath}: {e}")
            return None
    
    def parse_meta_tags_json(self, json_str):
        """Parse the JSON output into individual fields."""
        try:
            # Clean the JSON string if needed
            json_str = json_str.strip()
            if json_str.startswith("```json"):
                json_str = json_str[7:]
            if json_str.endswith("```"):
                json_str = json_str[:-3]
            json_str = json_str.strip()
            
            # Try to parse as JSON first
            try:
                meta_dict = json.loads(json_str)
            except json.JSONDecodeError:
                # If JSON parsing fails, try to evaluate as Python dict
                # This handles the case where Gemini returns Python dict format with single quotes
                try:
                    import ast
                    meta_dict = ast.literal_eval(json_str)
                except (ValueError, SyntaxError) as e:
                    logger.error(f"Failed to parse as Python dict: {e}")
                    raise
            
            # Convert complex data structures to strings for CSV storage
            def stringify_value(value):
                if isinstance(value, (list, dict)):
                    return json.dumps(value, ensure_ascii=False)
                return str(value)
            
            # Process each field and convert to string if needed
            for key, value in meta_dict.items():
                meta_dict[key] = stringify_value(value)
            
            # Ensure all required fields exist
            required_fields = [
                'character_primary', 'character_secondary', 'setting_primary', 'setting_secondary',
                'theme_primary', 'theme_secondary', 'events_primary', 'events_secondary',
                'emotions_primary', 'emotions_secondary', 'keywords'
            ]
            for field in required_fields:
                if field not in meta_dict:
                    meta_dict[field] = "Not specified"
            
            return meta_dict
            
        except Exception as e:
            logger.error(f"Error parsing JSON/Dict: {e}")
            logger.error(f"Input string: {json_str[:500]}...")  # Show first 500 chars
            # Return default values if parsing fails
            return {
                'character_primary': 'Error parsing',
                'character_secondary': 'Error parsing',
                'setting_primary': 'Error parsing',
                'setting_secondary': 'Error parsing',
                'theme_primary': 'Error parsing',
                'theme_secondary': 'Error parsing',
                'events_primary': 'Error parsing',
                'events_secondary': 'Error parsing',
                'emotions_primary': 'Error parsing',
                'emotions_secondary': 'Error parsing',
                'keywords': 'Error parsing'
            }
    
    def generate_meta_tags(self, story_text, filename):
        """Generate meta-tags for a single story."""
        try:
            logger.info(f"Generating meta-tags for: {filename}")
            
            # Truncate very long stories to avoid token limits
            max_chars = 10000  # Adjust based on model limits
            if len(story_text) > max_chars:
                story_text = story_text[:max_chars] + "..."
                logger.warning(f"Truncated {filename} to {max_chars} characters")
            
            # Generate meta-tags
            result = self.predictor(story_text=story_text)
            
            if self.use_cot:
                meta_tags_json = result.meta_tags_json
                analysis = result.analysis
                logger.info(f"Analysis for {filename}: {analysis[:100]}...")
            else:
                meta_tags_json = result.meta_tags_json
            
            # Parse the JSON output
            meta_dict = self.parse_meta_tags_json(meta_tags_json)
            
            return meta_dict
            
        except Exception as e:
            logger.error(f"Error generating meta-tags for {filename}: {e}")
            return {
                'character_primary': f'Error: {str(e)}',
                'character_secondary': 'Error',
                'setting_primary': 'Error',
                'setting_secondary': 'Error',
                'theme_primary': 'Error',
                'theme_secondary': 'Error',
                'events_primary': 'Error',
                'events_secondary': 'Error',
                'emotions_primary': 'Error',
                'emotions_secondary': 'Error',
                'keywords': 'Error'
            }
    
    def process_stories(self, csv_path, num_rows=None):
        """Process all stories and generate meta-tags."""
        try:
            # Read the CSV file
            df = pd.read_csv(csv_path)
            
            # # List of valid names (after the dash in filename)
            valid_names = [
                "A Butterfly Smile",
                "Hashim Saves the Mangoes",
                "Let's Play",
                "Rose and Rocky's War on Insects",
                "Dum Dum A Dum Biryani",
                "How Heavy is Air",
                "Goby's Noisy Best Friend",
                "Manikantan Has Enough",
                "Anna's Extraordinary Experiments with Weather",
                "How Bittu Bottu Got Better"
            ]

            # Function to convert title to kebab-case filename
            def title_to_filename(title):
                title = title.lower()                              # lowercase
                title = re.sub(r"[^a-z0-9]+", "-", title)          # replace non-alphanum with -
                title = re.sub(r"-+", "-", title).strip("-")       # remove multiple/trailing dashes
                return f"{title}.txt"

            # Apply transformation
            valid_names = [title_to_filename(name) for name in valid_names]
            logger.info(f"Valid filenames: {valid_names}")

            # Step 1: Create a temp column with part after first hyphen
            df['temp_name'] = df['filename'].apply(lambda x: "-".join(x.split('-')[1:]))

            # Step 2: Filter based on the temp column
            df = df[df['temp_name'].isin(valid_names)]

            # Step 3: Drop the temp column
            df = df.drop(columns=['temp_name'])

            # Determine number of rows to process
            if num_rows is None:
                num_rows = min(50, len(df))
            num_rows = min(num_rows, len(df))  # Ensure we don't exceed available rows
            logger.info(f"Processing {num_rows} out of {len(df)} stories")
            
            # Initialize lists for each meta-tag category
            results = {
                'filename': [],
                'character_primary': [],
                'character_secondary': [],
                'setting_primary': [],
                'setting_secondary': [],
                'theme_primary': [],
                'theme_secondary': [],
                'events_primary': [],
                'events_secondary': [],
                'emotions_primary': [],
                'emotions_secondary': [],
                'keywords': []
            }
            
            for idx, row in df.head(num_rows).iterrows():
                filename = row['filename']
                filepath = row['filepath']
                
                # Read story content
                story_text = self.read_story_file(filepath)
                if story_text is None:
                    # Add error entries
                    results['filename'].append(filename)
                    results['character_primary'].append("Error: Could not read file")
                    results['character_secondary'].append("Error")
                    results['setting_primary'].append("Error")
                    results['setting_secondary'].append("Error")
                    results['theme_primary'].append("Error")
                    results['theme_secondary'].append("Error")
                    results['events_primary'].append("Error")
                    results['events_secondary'].append("Error")
                    results['emotions_primary'].append("Error")
                    results['emotions_secondary'].append("Error")
                    results['keywords'].append("Error")
                    continue
                
                # Generate meta-tags
                meta_dict = self.generate_meta_tags(story_text, filename)
                
                # Add to results
                results['filename'].append(filename)
                results['character_primary'].append(meta_dict['character_primary'])
                results['character_secondary'].append(meta_dict['character_secondary'])
                results['setting_primary'].append(meta_dict['setting_primary'])
                results['setting_secondary'].append(meta_dict['setting_secondary'])
                results['theme_primary'].append(meta_dict['theme_primary'])
                results['theme_secondary'].append(meta_dict['theme_secondary'])
                results['events_primary'].append(meta_dict['events_primary'])
                results['events_secondary'].append(meta_dict['events_secondary'])
                results['emotions_primary'].append(meta_dict['emotions_primary'])
                results['emotions_secondary'].append(meta_dict['emotions_secondary'])
                results['keywords'].append(meta_dict['keywords'])
                
                logger.info(f"Processed {idx + 1}/{num_rows}: {filename}")
                logger.info(f"  Character Primary: {meta_dict['character_primary'][:50]}...")
                logger.info(f"  Setting Primary: {meta_dict['setting_primary'][:50]}...")
                logger.info(f"  Theme Primary: {meta_dict['theme_primary'][:50]}...")
                logger.info(f"  Events Primary: {meta_dict['events_primary'][:50]}...")
                logger.info(f"  Emotions Primary: {meta_dict['emotions_primary'][:50]}...")
                logger.info(f"  Keywords: {meta_dict['keywords'][:50]}...")  # Show first 50 chars
            
            # Create final DataFrame with proper handling of complex data
            final_df = pd.DataFrame(results)
            
            # Clean up any problematic characters that might cause CSV issues
            for col in final_df.columns:
                if col != 'filename':  # Don't modify filename
                    final_df[col] = final_df[col].astype(str).str.replace('\n', ' ').str.replace('\r', ' ')
            
            # Save final results with proper CSV settings
            output_file = "story_meta_tags_comprehensive.csv"
            final_df.to_csv(output_file, index=False, encoding='utf-8', escapechar='\\')
            logger.info(f"Saved comprehensive meta-tags to: {output_file}")
            
            # Also save a more readable JSON version for easier inspection
            json_output_file = "story_meta_tags_comprehensive.json"
            results_for_json = []
            for idx, row in final_df.iterrows():
                story_data = {"filename": row['filename']}
                for col in final_df.columns:
                    if col != 'filename':
                        try:
                            # Try to parse JSON fields back to objects for cleaner JSON output
                            if row[col].startswith('[') or row[col].startswith('{'):
                                story_data[col] = json.loads(row[col])
                            else:
                                story_data[col] = row[col]
                        except:
                            story_data[col] = row[col]
                results_for_json.append(story_data)
            
            with open(json_output_file, 'w', encoding='utf-8') as f:
                json.dump(results_for_json, f, indent=2, ensure_ascii=False)
            logger.info(f"Also saved readable JSON version to: {json_output_file}")
            
            return output_file
            
        except Exception as e:
            logger.error(f"Error processing stories: {e}")
            return None
    
    def run(self, stories_folder="./STEM-text-files", num_rows=None):
        """Run the complete pipeline."""
        logger.info("Starting story meta-tags generation pipeline")
        
        # Step 1: Scan for text files
        csv_path = self.scan_text_files(stories_folder)
        if csv_path is None:
            return
        
        # Step 2: Process stories and generate meta-tags
        output_file = self.process_stories(csv_path, num_rows=num_rows)
        if output_file:
            logger.info(f"Pipeline completed successfully! Results saved to: {output_file}")
            
            # Display sample results
            df = pd.read_csv(output_file)
            print("\n" + "="*80)
            print("SAMPLE RESULTS:")
            print("="*80)
            
            def display_field(field_name, field_value, max_items=3):
                """Display field in a readable format."""
                try:
                    # Try to parse as JSON first
                    if field_value.startswith('[') or field_value.startswith('{'):
                        parsed = json.loads(field_value)
                        if isinstance(parsed, list):
                            print(f"{field_name}:")
                            for i, item in enumerate(parsed[:max_items]):
                                if isinstance(item, dict):
                                    print(f"  {i+1}. {item.get('Name', item)}")
                                else:
                                    print(f"  {i+1}. {item}")
                            if len(parsed) > max_items:
                                print(f"  ... and {len(parsed) - max_items} more")
                        else:
                            print(f"{field_name}: {parsed}")
                    else:
                        # Simple string field
                        print(f"{field_name}: {field_value[:150]}{'...' if len(field_value) > 150 else ''}")
                except:
                    # Fallback to simple display
                    print(f"{field_name}: {str(field_value)[:150]}{'...' if len(str(field_value)) > 150 else ''}")
            
            for idx, row in df.head(2).iterrows():  # Show only 2 samples to avoid clutter
                print(f"\nFile: {row['filename']}")
                display_field("Character Primary", row['character_primary'])
                display_field("Character Secondary", row['character_secondary'])
                display_field("Setting Primary", row['setting_primary'])
                display_field("Setting Secondary", row['setting_secondary'])
                display_field("Theme Primary", row['theme_primary'])
                display_field("Theme Secondary", row['theme_secondary'])
                display_field("Events Primary", row['events_primary'])
                display_field("Events Secondary", row['events_secondary'])
                display_field("Emotions Primary", row['emotions_primary'])
                display_field("Emotions Secondary", row['emotions_secondary'])
                display_field("Keywords", row['keywords'])
                print("-" * 80)
        else:
            logger.error("Pipeline failed")

def main():
    """Main function with argument parsing."""
    parser = argparse.ArgumentParser(description='Generate story meta-tags using DSPy and Gemini 2.5')
    parser.add_argument('--cot', action='store_true', 
                       help='Use Chain of Thought reasoning for meta-tags generation')
    parser.add_argument('--folder', default='./STEM-text-files', 
                       help='Folder containing story text files (default: ./STEM-text-files)')
    parser.add_argument('--num_rows', type=int, default=None,
                       help='Number of stories to process (default: min(50, total stories))')
    
    args = parser.parse_args()
    
    try:
        # Initialize processor
        processor = StoryProcessor(use_cot=args.cot)
        
        # Run pipeline
        processor.run(args.folder, num_rows=args.num_rows)
        
    except Exception as e:
        logger.error(f"Application error: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())