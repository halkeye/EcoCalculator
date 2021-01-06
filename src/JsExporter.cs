/**
 * File: JsExporter.cs
 * Eco Version: 9.x
 * 
 * Author: koka
 * 
 * 
 * Exports recipes to use in javascript
 * 
 */

using System;
using System.Globalization;
using System.IO;
using System.Linq;
using Eco.Core.Plugins.Interfaces;
using Eco.Gameplay.DynamicValues;
using Eco.Gameplay.Items;
using Eco.Gameplay.Skills;
using Eco.Shared;
using Eco.Shared.Localization;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace JsExporter
{
    public class JsExporter : IModKitPlugin
    {
        private string _usedSkill;

        public JsExporter()
        {
            JToken result = new JObject();
            result["Version"] = EcoVersion.Version;
            result["Localization"] = new JObject();

            foreach (SupportedLanguage language in Enum.GetValues(typeof(SupportedLanguage)))
            {
                if (!Localizer.IsNormalizedLanguage(language))
                    continue;

                Localizer.TrySetLanguage(language);
                JObject localization = new JObject();
                result["Localization"][language.GetLocDisplayName().ToString()] = localization;

                foreach (Item item in Item.AllItems)
                {
                    localization[item.Name] = (string)item.DisplayName;
                }

                foreach (RecipeFamily family in RecipeFamily.AllRecipes)
                {
                    foreach (Recipe recipe in family.Recipes)
                    {
                        localization[recipe.Name] = (string)recipe.DisplayName;
                    }
                }
            }

            JObject recipes = new JObject();
            result["Recipes"] = recipes;
            foreach (RecipeFamily family in RecipeFamily.AllRecipes)
            {
                foreach (Recipe recipe in family.Recipes)
                {
                    JToken json = ProcessRecipeType(recipe);
                    json["skills"] = new JArray();
                    foreach (RequiresSkillAttribute req in family.RequiredSkills) {
                        ((JArray)json["skills"]).Add(req.SkillItem.Name);
                    }
                    recipes[recipe.Name] = json;
                }
            }

            using (TextWriter textWriter = new StreamWriter("config.json"))
            {
                textWriter.Write(JsonConvert.SerializeObject(result, Formatting.Indented));
            }
            return;
        }

        /// <inheritdoc />
        public string GetStatus()
        {
            return "Idle.";
        }

        /// <inheritdoc />
        public override string ToString()
        {
            return nameof(JsExporter);
        }

        /// <summary>
        /// Checks recipe
        /// </summary>
        private JToken ProcessRecipeType(Recipe recipe)
        {
            JObject result = new JObject();

            _usedSkill = null;
            bool first = true;
            // assert(recipe.Items.Count > 0, "Products array should be not empty");
            foreach (var craftingElement in recipe.Items)
            {
                string name = craftingElement.Item.Name;
                if (first)
                {
                    first = false;
                    result["result"] = name;
                    result["quantity"] = EvaluateDynamicValue(craftingElement.Quantity);
                    result["ingredients"] = new JObject();
                    continue;
                }

                result["ingredients"][name] = EvaluateDynamicValue(craftingElement.Quantity);
            }

            foreach (var craftingElement in recipe.Ingredients)
            {
                if (craftingElement.Item == null) { continue;  }
                string name = craftingElement.Item.Name;
                result["ingredients"][name] = EvaluateDynamicValue(craftingElement.Quantity);
            }

            if (_usedSkill != null)
            {
                result["skill"] = _usedSkill;
            }

            return result;
        }

        /// <summary>
        /// Converts Eco dynamic value to js
        /// </summary>
        private string EvaluateDynamicValue(IDynamicValue value)
        {
            if (value is ConstantValue)
            {
                return value.GetBaseValue.ToString(CultureInfo.InvariantCulture);
            }

            if (value is MultiDynamicValue multiValue)
            {
                string parameters = string.Join(",", multiValue.Values.Select(EvaluateDynamicValue));
                return $"Operation_{multiValue.Op}({parameters})";
            }

            if (value is SkillModifiedValue skillValue)
            {
                string values = string.Join(",", skillValue.Values.Select(floatValue => floatValue.ToString(CultureInfo.InvariantCulture)));
                _usedSkill = skillValue.SkillType.Name;
                return $"[{values}][skills[\"{skillValue.SkillType.Name}\"]]";
            }

            if (value is TalentModifiedValue talentValue)
            {
                return $"talents[\"{talentValue.TalentType.Name}\"] ? {talentValue.Talent.Value.ToString(CultureInfo.InvariantCulture)} : {talentValue.BaseValue.ToString(CultureInfo.InvariantCulture)}";
            }

            if (value is ModuleModifiedValue moduleModifiedValue)
            {
                return $"modules[\"{moduleModifiedValue.ValueTypeName}\"] ? {moduleModifiedValue.GetBaseValue.ToString(CultureInfo.InvariantCulture)} : 1";
            }

            throw new Exception($"Can't evaluate value {value}");
        }
    }
}

