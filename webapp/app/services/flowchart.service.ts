import { Injectable } from '@angular/core';
import { Flowchart} from "../models/flowchart.model";
import {FlowchartEntry, FlowchartEntryCompact} from "../models/flowchart-entry.model"
import { Http } from "@angular/http";
import 'rxjs/add/operator/toPromise';
import {Observable} from 'rxjs/Observable';
import {QuarterView} from '../models/quarter-view.model';
import {isNullOrUndefined} from "util";
import {UserService} from './user.service';
import {BehaviorSubject} from 'rxjs/BehaviorSubject';
import {FlowchartView} from '../models/flowchart-view.model';

@Injectable()
export class FlowchartService {

  private activeFlowchartId: number;
  private flowchartsMap = new Map<number, Flowchart>();

  private flowchartSource = new BehaviorSubject<Flowchart>(new Flowchart());
  private flowchart$ = this.flowchartSource.asObservable();

  private flowchartsSource = new BehaviorSubject<Flowchart[]> ([]);
  private flowcharts$ = this.flowchartsSource.asObservable();


  constructor(private http : Http){}

  // TODO: Make this more clear
  getFlowcharts(): Observable<Flowchart[]> {
    return this.http.get("api/flowcharts")
      .map(response => {
        return response.json() as Flowchart[];
    })
  }

  getCurrentFlowchart() : Observable<Flowchart>
  {
    return this.flowchart$;
  }

  getAllFlowcharts(): Observable<Flowchart[]> {
    return this.flowcharts$;
  }

  setCurrentFlowchartByIDInMap(id : number)
  {
    //TODO
    //Does not check if the key is in the map
    this.activeFlowchartId = id;
    this.flowchartSource.next(this.flowchartsMap.get(this.activeFlowchartId));
  }

  getCurrentFlowchartId(): Observable<number> {
    return this.flowchartSource.map((flowchart) => isNullOrUndefined(flowchart) ? -1 : flowchart.id);
  }

  getFlowchart(id : number): Observable<Flowchart> {
    return this.http.get(`api/flowcharts/${id}`)
      .map(response => {
        return response.json() as Flowchart
      });
  }

  /**
   * This the event stream originates from a POST to /api/flowcharts to create a new Flowchart for
   * the user. Returns an Observable of Flowcharts. For each emitted flowchart, the flowchart is
   * added to the Map of the users flowcharts. An array containing the new flowchart is emitted in
   * the flowcharts$ observable for subscribers to get updated array.
   * @returns {Observable<T>}
   */
  createFlowchart(): Observable<Flowchart> {
    return this.http.post("api/flowcharts", {})
      .map((response) => {
        let flowchart = response.json() as Flowchart;
        console.log(`Flowchart created. ID: ${flowchart.id}`);
        return flowchart;
      })
      .do((flowchart) => {
        console.log(`Adding flowchart ${flowchart.id} to flowchart map`);
        this.flowchartsMap.set(flowchart.id, flowchart);

        // update list of flowcharts
        console.log(`Emitting updated list of flowcharts`);
        this.flowchartsSource.next(Array.from(this.flowchartsMap.values()));
      }).catch((e) => `Error creating flowchart. ${e}`);
  }

  deleteFlowchart(id: number): Promise<any> {
    return this.http.delete(`/api/flowcharts/${id}`)
      .do(() => {
        console.log(`Flowchart deleted: ${id}`);

        console.log(`Removing flowchart ${id} from flowchart map`);
        this.flowchartsMap.delete(id);

        // update list of flowcharts
        console.log(`Emitting updated list of flowcharts`);
        this.flowchartsSource.next(Array.from(this.flowchartsMap.values()));

        // set another flowchart as active and emit event
        if(this.activeFlowchartId === id) {
          let flowchart = this.flowchartsMap.values().next().value;
            if (!isNullOrUndefined(flowchart)){
              this.activeFlowchartId = flowchart.id;
              this.flowchartSource.next(flowchart);
            } else {
              this.activeFlowchartId = -1;
              this.flowchartSource.next(null);
            }
        }
      })
      .toPromise()
      .catch((e) => {
        console.log(`Error deleting flowchart ${id}. ${e}`);
        return e;
      })
  }

  deleteEntry(entry: FlowchartEntry): void {
    console.log(`Deleting Entry ${entry.id} from flowchart ${this.activeFlowchartId}. User: ${UserService.getCurrentUser().email}` );
    this.http.delete(`api/entries/${entry.id}`)
      .catch(this.handleError)
      .toPromise()
      .then(() => {
        console.log(`Deleted entry ${entry.id}. Updating Flowchart.`)
        this.fetchAndUpdateActiveFlowchart();
      });
    }

  addEntry(entry: FlowchartEntryCompact): void {
    console.log(`Adding Entry ${JSON.stringify(entry)}. User: ${UserService.getCurrentUser().email}` );
    this.http.post(`api/entries/`, entry)
      .catch(this.handleError)
      .toPromise()
      .then(() => {
        console.log(`Adding Entry ${JSON.stringify(entry)}. User: ${UserService.getCurrentUser().email}` );
        this.fetchAndUpdateActiveFlowchart();
    });
  }

  updateEntry(id: number, entry: FlowchartEntry): Observable<void> {
    return this.http.put(`api/entries/${id}`, entry)
      .map(() => console.log(`Updated entry ${id}`))
      .catch(this.handleError);
  }

  private handleError(error: any): Promise<any> {
    console.log('An error occurred', error); // for demo purposes only
    return Promise.reject(error.message || error);
  }

  // TODO: Make this more clear
  fetchAndUpdateActiveFlowchart() {
    console.log('fetchAndUpdateActiveFlowchart');
    if (isNullOrUndefined(this.activeFlowchartId)){
      this.flowchartSource.next(null); // return null flowchart
      return;
    }

    this.getFlowchart(this.activeFlowchartId)
      .toPromise()
      .then((flowchart) => {
        this.flowchartsMap.set(flowchart.id, flowchart); //update local map
        this.flowchartSource.next(flowchart);
    });
  }

  // TODO: Make this more clear
  fetchAndUpdateAllFlowcharts() {
    console.log("fetchAndUpdateAllFlowcharts");
    this.getFlowcharts()
      .toPromise()
      .then((flowcharts) => {
        console.log(`Found ${flowcharts.length} flowcharts`);
        this.flowchartsMap = this.buildFlowchartMap(flowcharts);

        if(isNullOrUndefined(this.activeFlowchartId) && flowcharts.length > 0){
          this.activeFlowchartId = flowcharts[0].id;
        }

        this.flowchartSource.next(this.flowchartsMap.get(this.activeFlowchartId));
        this.flowchartsSource.next(flowcharts);
      });
  }

  clearData() {
    console.log("clearing local flowchart data");
    this.activeFlowchartId = null;
    this.flowchartsMap.clear();
    this.flowchartSource.next(null);
    this.flowchartsSource.next(null);
  }

  private buildFlowchartMap(flowcharts: Flowchart[]): Map<number, Flowchart> {
    let flowchartMap = new Map();
    for (let flowchart of flowcharts)
    {
      flowchartMap.set(flowchart.id, flowchart);
    }

    return flowchartMap;
  }

  // This is a utility method
  static parseQuarters(flowchart: Flowchart): QuarterView[] {
    if (isNullOrUndefined(flowchart)
      || isNullOrUndefined(flowchart.entries)
      || flowchart.entries.length === 0) {

      return [];
    }

    let quarters = new Map();
    for (let entry of flowchart.entries){
      const quarterId = entry.quarter.id;

      // Populate list of QuarterViews
      let quarterView = quarters.get(quarterId); // check if QuarterView for quarter exists
      if (isNullOrUndefined(quarterView)) {
        quarterView = new QuarterView();
        quarterView.quarter = entry.quarter;
        quarters.set(quarterId, quarterView)
      }

      quarterView.entries.push(entry); // add entry to quarter
    }

    //TODO return the map sorted ?
    return Array.from(quarters.values());
  }

  // This is a utility method
  static buildFlowchartView(flowchart: Flowchart): FlowchartView {
    return {flowchart: flowchart, quarters: FlowchartService.parseQuarters(flowchart)};
  }
}
