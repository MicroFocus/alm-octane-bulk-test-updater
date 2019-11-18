/*
Copyright 2019 EntIT Software LLC, a Micro Focus company, L.P.
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
  http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */

const Query = require("@microfocus/alm-octane-js-rest-sdk/lib/query");
const log4js = require('log4js');
const Octane = require("@microfocus/alm-octane-js-rest-sdk");
let configurationJSON = require("../configuration.json");
const commandLineArgs = require('command-line-args');
configurationJSON.server.tech_preview_API = true;
const maxPageSize = configurationJSON.maxPageSize || 20000;
log4js.configure("./logs_configuration.json");
const logger = log4js.getLogger();
const ALL_TESTS = "all tests";
const UNASSIGNED_TESTS = "unassigned tests";
let tests_processed = [];

const optionDefinitions = [
    {name: 'release', alias: 'r', type: String, defaultOption: true},
    {name: 'appModule', alias: 'a', type: String},
    {name: 'useStrictAppModule', alias: 's', type: Boolean}
];
const commandLineArguments = commandLineArgs(optionDefinitions);
commandLineArguments.release = commandLineArguments.release || configurationJSON.release;
commandLineArguments.appModule = commandLineArguments.appModule || configurationJSON.appModule;
commandLineArguments.useStrictAppModule = commandLineArguments.useStrictAppModule || configurationJSON.useStrictAppModule;


function bulkUpdate(octane, release, applicationModule, versionToUpdate, offset) {
    logger.debug("using the max page size:" + maxPageSize);
    let requestObj = {
        fields: 'releases,name,test,comment',
        order_by: '-name',
        offset: offset,
        limit: maxPageSize
    };
    if (versionToUpdate && versionToUpdate !== "") {
        requestObj.query = Query.field("comment").equal(versionToUpdate);
    }
    let query;
    switch (applicationModule) {
        case ALL_TESTS:
            break;
        case UNASSIGNED_TESTS:
            query = Query.field("test").equal(Query.field("product_areas").equal(Query.NULL_REFERENCE));
            if (requestObj.query) {
                requestObj.query = query.and(requestObj.query);
            } else {
                requestObj.query = query;
            }
            break;
        default:
            query = Query.field("test").equal(Query.field("product_areas").equal(Query.field("path").equal(applicationModule.path)));
            if (requestObj.query) {
                requestObj.query = query.and(requestObj.query);
            } else {
                requestObj.query = query;
            }

    }

    octane.testVersions.getAll(
        requestObj,
        function (err, entities) {
            if (err) {
                if (err.code === 403) {
                    logger.error("The user in the configuration file does not have the necessary permissions to" +
                        " update the test version entities in workspace " + configurationJSON.server.workspace_id +
                        "\n\tError: " + JSON.stringify(err))
                }
                if (err.code === 400 && err.message.description.includes("limit")) {
                    logger.error("The maxPageSize parameter is too large (" + maxPageSize + "). " +
                        "Check the octane site parameter \'MAX_PAGE_SIZE\' and use that as the maxPageSize in " +
                        "the configuration file.\n\tFull error message: " + JSON.stringify(err));
                } else {
                    logger.error(err);
                }
                return;
            }
            if (offset === 0) {
                logger.info("total of " + entities.meta.total_count + " test versions, starting from offset 0")
            } else {
                logger.info("Got to offset " + offset);
            }

            let test_version;
            for (test_version of entities) {
                if (!tests_processed.includes(test_version.test.id)) {
                    if (versionToUpdate === "*" && (test_version.comment === "" || test_version.comment == null)) {
                        continue;
                    }
                    if (versionToUpdate.includes("*")) {
                        logger.debug("Full comment of the test version is \"" + test_version.comment + "\"")
                    }
                    logger.debug("Considering the test version with id " + test_version.id + " as the version that needs to be updated for the test with id " + test_version.test.id + " and marking the test as processed");
                    tests_processed.push(test_version.test.id);
                    updateTestVersion(octane, test_version, release);

                }
            }

            let newOffset = offset + entities.length;
            if (entities.meta.total_count > newOffset) {
                bulkUpdate(octane, release, versionToUpdate, newOffset);
            }


        }
    );

}

async function updateTestVersion(octane, test_version, release) {
    let releases;
    let releasesIds;
    releases = test_version.releases.data;
    releasesIds = releases.map(rel => rel.id);
    if (!releasesIds.includes(release.id)) {
        releases.push(release);
        logger.info("Adding release \'" + release.name + "\' to the test version with id " + test_version.id + " of the test with id " + test_version.test.id);
        octane.testVersions.update({
                id: test_version.id,
                releases: releases
            },
            function (err, ent) {
                if (err) {
                    if (err.code === 403) {
                        logger.error("The user in the configuration file does not have the necessary permissions to update the test version entities in workspace " + configurationJSON.server.workspace_id)
                    }
                    logger.error(err);
                } else {
                    logger.info("Test version with id " + ent.id + " was updated succesfully");
                }
            }
        )
    } else {
        logger.info("Test " + test_version.test.id + " already has the release \'" + release.name + "\' set for the latest version of the test")
    }

}


function getRelease(octane) {
    let field;
    let releaseIdentifier = commandLineArguments.release;
    let query;
    if (releaseIdentifier === undefined) {
        field = "id";
        releaseIdentifier = 'current_release';
        query = Query.field("id").inComparison(['current_release']);
    } else {
        if (isNaN(releaseIdentifier)) {
            field = "name";
        } else {
            field = "id";
        }
        query = Query.field(field).equal(releaseIdentifier)
    }
    logger.debug("Getting release with the field " + field + " equal to " + releaseIdentifier);
    return new Promise((resolve, reject) => {
        octane.releases.getAll({
                fields: 'id,name,activity_level',
                query: query
            }, function (err, releases) {
                if (err) {
                    if (err.code === 404) {
                        logger.error("The user in the configuration file might not have the necessary " +
                            "permissions to access workspace " + configurationJSON.server.workspace_id +
                            "\n\tError: " + JSON.stringify(err))
                    }
                    logger.error(err);
                    reject();
                } else {
                    if (releases.length < 1) {
                        logger.error("No release found with the " + field + ":" + releaseIdentifier);
                    } else if (releases.length > 1) {
                        logger.error("More than one release was found with the " + field + ":" + releaseIdentifier);
                    } else {
                        if (releases[0].activity_level === 0) {
                            logger.info("Will add the release \'" + releases[0].name + "\' (id:" + releases[0].id + ") to the tests.");
                            return resolve(releases[0]);
                        } else {
                            logger.error("The release \'" + releases[0].name + "\' (id:" + releases[0].id + ") cannot be used because it is not active.");
                        }
                    }
                }
                reject();
            }
        )
    });
}


function getApplicationModule(octane) {
    return new Promise(((resolve, reject) => {
        let applicationModuleIdentifier = commandLineArguments.appModule;
        if (!applicationModuleIdentifier) {
            logger.info("Will consider all the tests for the update");
            return resolve(ALL_TESTS);
        }
        let query;
        if (isNaN(applicationModuleIdentifier)) {
            switch (applicationModuleIdentifier.toUpperCase()) {
                case "UNASSIGNED":
                    logger.info("Will only consider tests which are not assigned to an application module");
                    return resolve(UNASSIGNED_TESTS);
                case "ROOT":
                    commandLineArguments.useStrictAppModule = false;
                    logger.info("Will consider all the tests which have at least an application module assigned");
                    query = Query.field("logical_name").equal("product_area.root");
                    break;
                case "ALL":
                    logger.info("Will consider all the tests for the update");
                    return resolve(ALL_TESTS);
                default:
                    logger.error("Invalid application module parameter.The only supported values are integers or the strings \"unassigned\"  and \"root\",but got \"" + applicationModuleIdentifier + "\" as a parameter.");
                    return reject();
            }
        } else {
            logger.debug("Using the application module id:" + applicationModuleIdentifier);
            query = Query.field("id").equal(applicationModuleIdentifier);
        }
        octane.productAreas.getAll(
            {
                fields: "name,logical_name,id,path",
                query: query
            },
            function (err, applicationModules) {
                if (applicationModules.length < 1) {
                    logger.error("No application module found.\n\tQuery used:" + JSON.stringify(query));
                } else if (applicationModules.length > 1) {
                    logger.error("More than one application module was found.\n\t Query used:" + JSON.stringify(query) + "\n\tResponse received:" + JSON.stringify(applicationModules));
                } else {
                    if (commandLineArguments.useStrictAppModule) {
                        logger.info("Will only consider tests assigned to the application module '" + applicationModules[0].name + "' (id:" + applicationModules[0].id + ") (not including descendents)");
                    } else {
                        logger.info("Will only consider tests assigned to the application module '" + applicationModules[0].name + "' (id:" + applicationModules[0].id + ") and its descendents");
                        applicationModules[0].path = applicationModules[0].path + "*";
                    }
                    logger.debug("Application module path: " + applicationModules[0].path);
                    return resolve(applicationModules[0]);
                }
                return reject();
            }
        )
    }));
}

if (require.main === module) {
    const user = configurationJSON.authentication;
    const octane = new Octane(configurationJSON.server);
    octane.authenticate(user, async function (err) {
        if (err) {
            logger.error("Failed to authenticate. Error:" + JSON.stringify(err));
            process.exit(1);
        } else {
            logger.info("Logged in succesfully");
            try {
                let release = getRelease(octane).catch(() => {
                    logger.error("Could not get the release reference. Exiting...");
                    process.exit(1)
                });
                let applicationModule = getApplicationModule(octane).catch(() => {
                    logger.error("Could not get the application reference. Exiting...");
                    process.exit(1)
                });
                release = await release;
                applicationModule = await applicationModule;
                logger.info("Will consider test versions with the comment : \"" + configurationJSON.versionToUpdate + "\"");
                bulkUpdate(octane, release, applicationModule, configurationJSON.versionToUpdate, 0);
            } catch (e) {
                if (e.stack.match(/TypeError: Cannot read property '(.*)' of undefined/) != null) {
                    logger.error("An error occurred while using the octane SDK. The setup for the SDK might not have " +
                        "been done. Run the \'node scripts/sdk-setup.js\' command and try again.\n\t" +
                        "Error message:" + e.message + "\n\t" +
                        "Stack:" + e.stack);
                } else {
                    logger.error(e);
                }
            }
        }
    });
}
