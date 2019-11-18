# Bulk test version updater 
This project provides a script which can be used to update the latest version of all the tests in Octane

## Table of content
1. [Prerequisites](#Prerequisites)
2. [Installation](#Installation)
3. [Configuration File](#Configuration-File)
4. [Limitations](#Limitations)
5. [Running](#Running)

## Prerequisites
[Node JS](https://nodejs.org/en/download/) - version 8.11.3 or above

Octane - version 15.0.20.54 or above

## Installation
All the commands should be run from the root of the project
1. Run `npm install` 
2. Make the necessary changes in the configuration file: 
[configuration.json](#Configuration-file)
3. Run the `node scripts/sdk-setup.js` command. This command [updates the client API
](https://github.com/MicroFocus/alm-octane-js-rest-sdk#update-client-api) of the octane sdk.

## Configuration File
The configuration file is a **JSON** which has the following structure:
``` 
{
  "server": {
    "protocol": "http",
    "host": "<MY_OCTANE_SERVER>",
    "port": <PORT>,
    "proxy": "<PROXY_USED_TO_REACH_OCTANE>",
    "shared_space_id": <SHARED_SPACE_ID>,
    "workspace_id": <WORKSPACE_ID>
  },
  "authentication": {
    "username": "<API_CLIENT_ID_OR_USERNAME>",
    "password": "<API_CLIENT_SECRET_OR_PASSWORD>"
  },
  "maxPageSize": <OCTANE_MAX_PAGE_SIZE>,
  "versionToUpdate": false
}
```

If an *OPTIONAL* field is not needed, it should not be present in the configuration file when running the script.


| Field name | Value | Description |
| --- | --- | --- |
  server | JSON with the fields described below | All the information about the octane server 
  |├⇢ protocol |String | The protocol of the octane server (e.g. "http"/"https")
  |├⇢ host | String | The host of the octane server (e.g. "myOctaneServer.com")  
  |├⇢ port| Integer | *OPTIONAL* The port of the octane server (e.g. 8080). Needed only if the octane server url has a port. 
  |├⇢ proxy | String | *OPTIONAL* Used if a proxy is needed to reach octane (e.g. "http://myProxyServer:port")
  |├⇢ shared_space_id | Integer | The id of the shared space for which the script should run (e.g. 1001) 
  |└⇢ workspace_id | Integer | The id of the workspace for which the script should run (e.g. 1002) 
  |authentication|JSON with the fields described below| Either an [API client id and secret](https://admhelp.microfocus.com/octane/en/latest/Online/Content/AdminGuide/how_setup_APIaccess.htm) pair or a username and password pair  with the role of at least "Team Member" in the workspace with id `workspace_id`  
  |├⇢ username| String | The API client id or username with the role of at least "Team Member" in the desired workspace  
  |└⇢ password| String | The API client secret or password 
  |versionToUpdate | String | The Name (in the version column of the test version) of the tests which should be updated. The `*` can be used as a [wild card](https://admhelp.microfocus.com/octane/en/latest/Online/Content/API/query_Clause.htm). An empty string `""` will result in the latest version of the test being updated. Using `"*"` will update the latest named version.    
  |maxPageSize | Integer | *OPTIONAL* This field should be equal to the MAX_PAGE_SIZE [site parameter](https://admhelp.microfocus.com/octane/en/latest/Online/Content/AdminGuide/params.htm). The default value used is the same as the octane default value (20000).    


  ![Named vs Unnamed version](/images/Named%20vs%20Unnamed.png)
  

## Limitations
   The script has the following limitations:
   * If new versions of tests are created (including creation of new tests) while the script is running, they will not 
   be considered for the current run of the script and thus will not be updated. 
   * If a user manually updates a revision that would also be updated by the script 
   (e.g. manually adding a release to the latest revision of a test), the user or the script updates might 
   not be saved depending on the order of the updates.
   
   Because of these limitations, we recommend that all the version views of all the tests be
   closed before running the script and no new versions of the tests are created while the script is 
   running.   
     
## Running
 The script can accept the following parameters:
 
  | Name | Argument prefix | Value | Default Interpretation | Description |
  | ---- | --------------- | ----- | ---------------------- | ----------- |
  |Release |  `--release` or `-r` or no prefix | **String** - The name of the release OR **Integer** - The id of the release | The default release will be ued to update the tests | The release which will be added to the latest version (according to the [configuration file](#Configuration-file)) of every test script
  |Application Module | `--appModule` or `-a` | **Integer** - The id of an application module OR `root` OR `unassigned` OR `all` | All the tests will be considered | If this parameter is present, only tests assigned to the selected application module and its descendants will be updated. When using `root` only tests that have an application module assigned will be updated. When using `unassigned`, only tests which are not assigned to any application module will be updated. Using `all` is the same as using the default interpretation   
  |Strict Application Module | `--useStrictAppModule` or `-s` | **Boolean** | The tests belonging to the descendants of the given application module will also be updated | **True** - if the application module is given as an id, only tests from the exact application module will be updated (no descendants). **False** - same as using the default interpretation.
 
 
 All the command line parameters can also be taken from the JSON configuration file 
 using the full prefix and the value of the parameter(e.g. `"release": 1001`). If a parameter is not given as a command 
 line argument, the configuration file will be checked for the value of that parameter and if that parameter is not 
 found in the configuration file, the default interpretation of the value will be used. Setting a parameter in 
 the configuration file will prevent the "default interpretation" of that parameter, but this way a custom default 
 value can be set.
 
 After the [installation](#Installation), the script can be run with one of the following command from the root 
 of the project:  `node src/bulk_update_test_versions.js`.
        
  Because the release parameter has 3 ways of giving the argument prefix, the following commands are equivalent and 
  they all update the tests with the release `Release 1` with id `1001`    
  * using the ID:
  
        node src/bulk_update_test_versions.js 1001
        node src/bulk_update_test_versions.js -r 1001
        node src/bulk_update_test_versions.js --release 1001
  
  * using the name of the release :
  
        node src/bulk_update_test_versions.js "Release 1"
        node src/bulk_update_test_versions.js -r "Release 1"
        node src/bulk_update_test_versions.js --release "Release 1"
  
  Here are other examples of using the command line arguments with an application module with id 2002:   
  * `node src/bulk_update_test_versions.js -a 2002` - updates the tests belonging to the application module 
  with the id 2002 and all its descendants with the default release
  * `node src/bulk_update_test_versions.js -sa 2002`- updates the tests belonging to the application module 
  with the id 2002 with the default release. The tests belonging to the descendants of the application module will not be updated.
  * `node src/bulk_update_test_versions.js "Release 1" -sa 2002` updates the tests belonging to the application 
  module with the id 2002 with the release "Release 1". The tests belonging to the descendants of the application 
  module will not be updated.
      
  
