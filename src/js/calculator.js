import React, {Fragment} from 'react';
import Ingredients from './ingredients';
import Results from './results';
import Skills from './skills';
import Language from './language';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { Map, Set } from 'immutable';
import ExportDialog from "./export-dialog";
import ImportDialog from "./import-dialog";

/**
 * Main calculator
 */
export default class Calculator extends React.Component {
    constructor(props) {
        super(props);
        this.handleLanguageChange = this.handleLanguageChange.bind(this);

        this.handleAddSkill = this.handleAddSkill.bind(this);
        this.handleRemoveSkill = this.handleRemoveSkill.bind(this);
        this.handleChangeSkill = this.handleChangeSkill.bind(this);

        this.handleImport = this.handleImport.bind(this);

        this.handlePriceChanged = this.handlePriceChanged.bind(this);

        this.handleAddRecipe = this.handleAddRecipe.bind(this);
        this.handleRemoveRecipe = this.handleRemoveRecipe.bind(this);

        const allSkills = [];
        Object.values(props.config.Recipes).forEach(recipe => {
          allSkills.push(...recipe.skills || [])
        });

        const languages = Object.keys(this.props.config.Localization);

        this.state = {
            selectedRecipes: Map(),
            restRecipes: Object.keys(this.props.config.Recipes),
            allSkills: Array.from(new Set(allSkills)),
            skills: Map(),
            ingredients: {},
            languages: languages,
            language: languages[0],
            localization: this.props.config.Localization[languages[0]],
            exportData: Map(),
        }
    }

    /**
     * On changing language
     */
    handleLanguageChange(language) {
        this.setState({
            language: language,
            localization: this.props.config.Localization[language]
        });
    }

    /**
     * On adding single recipe
     */
    handleAddRecipe(recipe) {
        this.setState((state, props) => {
            const index = state.restRecipes.indexOf(recipe);
            if (index < 0)
                return {};

            return {
                selectedRecipes: state.selectedRecipes.update(
                    props.config.Recipes[recipe].result,
                    (val = Map()) => val.set(recipe, 0)
                ),
            };
        });

        this.setState(this.updateRecipes);
        this.setState(this.updatePrices);
        this.setState(Calculator.updateExportData);
    }

    /**
     * On adding all recipes with specified skill
     */
    handleAddSkill(skillName) {
        if(typeof skillName === 'undefined')
            return;

        this.setState((state, props) => {
            let selectedRecipes = state.selectedRecipes;
            const recipes = props.config.Recipes;

            state.restRecipes
                .filter(recipe => recipes[recipe].skills.includes(skillName))
                .forEach(recipe => {
                    selectedRecipes = selectedRecipes.update(
                        recipes[recipe].result,
                        (val = Map()) => val.set(recipe, 0)
                    );
                });

            return {selectedRecipes: selectedRecipes};
        });
        this.setState(this.updateRecipes);
        this.setState(this.updatePrices);
        this.setState(Calculator.updateExportData);
    }

    /**
     * On removing all recipes with specified skill
     */
    handleRemoveSkill(skillName) {
        if(typeof skillName === 'undefined')
            return;

        this.setState((state, props) => {
            return {selectedRecipes:
                    state.selectedRecipes
                        .map((recipes) => recipes.filterNot((price, recipe) => props.config.Recipes[recipe].skills.includes(skillName)))
                        .filter((recipes) => recipes.size > 0)
            };
        });
        this.setState(this.updateRecipes);
        this.setState(this.updatePrices);
        this.setState(Calculator.updateExportData);
    }


    /**
     * On removing recipe
     */
    handleRemoveRecipe(recipe) {
        const recipes = this.props.config.Recipes;

        if(this.state.selectedRecipes.has(recipe)){
            // it's result item
            this.setState({
                selectedRecipes: this.state.selectedRecipes.delete(recipe)
            });
        } else {
            // it's recipe
            this.setState({
                selectedRecipes: this.state.selectedRecipes.update(
                    recipes[recipe].result,
                    (val = Map()) => val.delete(recipe))
                    .filter(val => val.size > 0)
            });
        }
        this.setState(this.updateRecipes);
        this.setState(this.updatePrices);
        this.setState(Calculator.updateExportData);
    }

    /**
     * Updates export data
     */
    static updateExportData(state, props){
        return {
            'exportData': {
                'skills': state.skills,
                'ingredients': state.ingredients,
                'recipes': state.selectedRecipes.map(value => value.keySeq()).valueSeq().flatten()
            }
        };
    }

    /**
     * Imports data from json
     */
    handleImport(dataStr){
        let data = JSON.parse(dataStr);
        this.setState((state, props) => {
            let recipes = Map();
            data['recipes'].forEach((recipeName) => {
                recipes = recipes.update(props.config.Recipes[recipeName].result, Map(), recipeMap => recipeMap.set(recipeName, 0));
            });

            return {
                skills: Map(data['skills']).map((value) => Map(value)),
                ingredients: data['ingredients'],
                selectedRecipes: recipes
            };
        });
        this.setState(this.updateRecipes);
        this.setState(this.updatePrices);
        this.setState(Calculator.updateExportData);
    }

    /**
     * Updates skills & ingredients for selected recipes
     */
    updateRecipes(state, props){
        const selectedRecipes = state.selectedRecipes;

        const newRestRecipes =
            Object.keys(props.config.Recipes)
            .filter(recipe => !selectedRecipes.get(props.config.Recipes[recipe].result, Map()).has(recipe));

        let usedSkills = Set().withMutations(usedSkills => {
            selectedRecipes.valueSeq().forEach((recipes) => {
                recipes.keySeq().forEach((recipe) => {
                    if (props.config.Recipes[recipe].skills.length) {
                        usedSkills.add(...props.config.Recipes[recipe].skills);
                    }
                });
            });
        });

        const newIngredients = {};
        selectedRecipes.valueSeq().forEach((recipes) => {
            recipes.keySeq().forEach((recipe) => {
                Object.keys(props.config.Recipes[recipe].ingredients).forEach((ingredient) => {
                    newIngredients[ingredient] = (typeof state.ingredients[ingredient] !== 'undefined') ? state.ingredients[ingredient] : 0;
                });
            });
        });

        selectedRecipes.keySeq().forEach((result) => {
            delete newIngredients[result];
        });

        return {
            restRecipes: newRestRecipes,
            skills: state.skills
                .filter((skillData, skillName) => usedSkills.has(skillName))
                .withMutations((skills) => {
                    usedSkills.toSeq().forEach((skillName) => {
                        if(skills.has(skillName))
                            return;

                        skills.set(skillName, Map({'value': 0, 'lavish': false}));
                    });
                }),
            ingredients: newIngredients
        };
    }

    /**
     * When user updates skill value
     */
    handleChangeSkill(skillName, skillData){
        let skillValue = parseInt(skillData.get('value'));
        if(isNaN(skillValue)){
            skillValue = 0;
        }

        if(skillValue < 0){
            skillValue = 0;
        }

        if(skillValue >= 10){
            skillValue = skillValue % 10;
        }

        if(skillValue > 7){
            skillValue = 7;
        }

        let lavishValue = skillData.get('lavish');
        if(skillValue < 6) {
            lavishValue = false;
        }

        this.setState((state) => {
            if(skillValue >= 6 && state.skills.get(skillName).get('value') < 6 ){
                lavishValue = true;
            }

            return {
                skills: state.skills
                    .setIn([skillName, 'value'], skillValue)
                    .setIn([skillName, 'lavish'], lavishValue)
            };
        });
        this.setState(this.updatePrices);
        this.setState(Calculator.updateExportData);
    }

    /**
     * When user updates ingredient price
     */
    handlePriceChanged(ingreident, price){
        const newIngredient = {};
        Object.assign(newIngredient, this.state.ingredients);

        price = price.replace(",", ".");
        if(isNaN(parseFloat(price))){
            newIngredient[ingreident] = 0;
        } else {
            newIngredient[ingreident] = price;
        }

        this.setState({
            ingredients: newIngredient
        });
        this.setState(this.updatePrices);
        this.setState(Calculator.updateExportData);
    }

    updatePrices(state, props){
        const ingredientPrices = {};
        const talents = {};
        const skills = {};
        const modules = {};

        state.skills.entrySeq().forEach(([skillName, skillData]) => {
            skills[skillName] = skillData.get('value');
            const talentName = skillName.substring(0, skillName.length - 5)  + "LavishResourcesTalent";
            talents[talentName] = skillData.get('lavish');
        });

        Object.keys(state.ingredients).forEach(ingredient => {
            ingredientPrices[ingredient] = parseFloat(state.ingredients[ingredient]);
        });

        let makeWork = true;
        let tries = 0;
        let selectedRecipes = state.selectedRecipes;
        while(makeWork){
            makeWork = false;
            tries++;
            if(tries > 100){
                console.log("Too much iterations in calculation");
                return;
            }

            state.selectedRecipes.valueSeq().forEach((recipes) => {
                recipes.keySeq().forEach((recipe) => {
                    let allIngredientsKnown = true;
                    let price = 0;
                    Object.keys(props.config.Recipes[recipe].ingredients).forEach((ingredient) => {
                        if(typeof ingredientPrices[ingredient] === 'undefined'){
                            allIngredientsKnown = false;
                            return;
                        }

                        price += ingredientPrices[ingredient] * props.config.Recipes[recipe].ingredients[ingredient](skills, talents, modules);
                    });

                    if(!allIngredientsKnown)
                        return;

                    price /= props.config.Recipes[recipe].quantity(skills, talents, modules);

                    const product = props.config.Recipes[recipe].result;
                    selectedRecipes = selectedRecipes.setIn([product, recipe], price);

                    if(typeof ingredientPrices[product] !== 'undefined' && ingredientPrices[product] <= price)
                        return;

                    ingredientPrices[product] = price;
                    makeWork = true;
                });
            });
        }

        return {
            selectedRecipes: selectedRecipes
        };
    }

    render(){
        return(
            <Fragment>
                <Row>
                    <Col xs="auto">
                        <h1>Eco production calculator for ver {this.props.config.Version}</h1>
                    </Col>
                    <Col>
                        <Language
                            selected={this.state.language}
                            languages={this.state.languages}
                            onChange={this.handleLanguageChange}
                        />
                    </Col>
                </Row>
                <Row>
                    <Col xs={4} className="border mr-1">
                        <h2 className="text-center">Skills</h2>
                        <Skills
                            allSkills={this.state.allSkills}
                            skills={this.state.skills}
                            localization={this.state.localization}
                            onChangeSkill={this.handleChangeSkill}
                            onAddSkill={this.handleAddSkill}
                            onRemoveSkill={this.handleRemoveSkill}
                        />

                    </Col>
                    <Col xs={3} className="border mr-1">
                        <h2 className="text-center">Ingredient prices</h2>
                        <Ingredients
                            ingredients={this.state.ingredients}
                            localization={this.state.localization}
                            onPriceChanged={this.handlePriceChanged} />
                    </Col>
                    <Col className="border">
                        <h2 className="text-center">Output prices</h2>
                        <Results
                            results={this.state.selectedRecipes}
                            restRecipes={this.state.restRecipes}
                            localization={this.state.localization}
                            onRemoveRecipe={this.handleRemoveRecipe}
                            onAddRecipe={this.handleAddRecipe}
                        />
                    </Col>
                </Row>
                <ExportDialog
                    data={this.state.exportData}
                    onClose={this.props.onExportClose}
                    show={this.props.exportOpened}
                />
                <ImportDialog
                    onClose={this.props.onImportClose}
                    onImport={this.handleImport}
                    show={this.props.importOpened}
                />
            </Fragment>
        )
    }
}
